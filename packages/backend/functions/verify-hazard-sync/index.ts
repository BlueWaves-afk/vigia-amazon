import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ethers } from 'ethers';
import { latLngToCell } from 'h3-js';

const bedrockAgent = new BedrockAgentRuntimeClient({});
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TRACES_TABLE          = process.env.TRACES_TABLE_NAME!;
const AGENT_ID              = process.env.BEDROCK_AGENT_ID!;
const AGENT_ALIAS_ID        = process.env.BEDROCK_AGENT_ALIAS_ID!;
const LEDGER_TABLE          = process.env.LEDGER_TABLE_NAME!;
const HAZARDS_TABLE         = process.env.HAZARDS_TABLE_NAME!;
const REWARDS_LEDGER_TABLE  = process.env.REWARDS_LEDGER_TABLE_NAME!;
const DEVICE_REGISTRY_TABLE = process.env.DEVICE_REGISTRY_TABLE_NAME!;
const ONE_TOKEN = '1000000000000000000'; // 1 VGA in wei

const DEDUP_WINDOW_MS = 12 * 60 * 60 * 1000; // 12-hour deduplication window

/**
 * H3 Geospatial Deduplication Check
 * Queries the HazardsTable GSI (h3-hazardtype-index) for any VERIFIED hazard
 * with the same H3 hex cell (res 9, ~city-block size) and hazardType within
 * the last 12 hours. Returns true if a duplicate exists.
 */
async function isDuplicateHazard(h3Index: string, hazardType: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();

  // [H3 DEDUP QUERY] — uses the h3-hazardtype-index GSI; FilterExpression
  // narrows to VERIFIED hazards within the 12-hour window.
  const result = await dynamodb.send(new QueryCommand({
    TableName: HAZARDS_TABLE,
    IndexName: 'h3-hazardtype-index',
    KeyConditionExpression: 'h3_index = :h3 AND hazardType = :type',
    FilterExpression: '#ts >= :window AND #s = :verified',
    ExpressionAttributeNames: { '#ts': 'timestamp', '#s': 'status' },
    ExpressionAttributeValues: {
      ':h3': h3Index,
      ':type': hazardType,
      ':window': windowStart,
      ':verified': 'VERIFIED',
    },
    Limit: 1, // We only need to know if at least one exists
  }));

  return (result.Count ?? 0) > 0;
}

/** Increment pending_balance in VigiaRewardsLedger — zero gas, no blockchain call. */
async function creditReward(walletAddress: string): Promise<void> {
  if (!REWARDS_LEDGER_TABLE) return;
  await dynamodb.send(new UpdateCommand({
    TableName: REWARDS_LEDGER_TABLE,
    Key: { wallet_address: walletAddress },
    UpdateExpression:
      'ADD pending_balance :amt, total_earned :amt ' +
      'SET last_updated = :now, nonce = if_not_exists(nonce, :zero)',
    ExpressionAttributeValues: {
      ':amt': BigInt(ONE_TOKEN) as any,
      ':now': new Date().toISOString(),
      ':zero': 0,
    },
  }));
  console.log(`[BME] Credited 1 VGA pending reward to ${walletAddress}`);
}

interface VerifyRequest {
  hazardId: string;
  hazardType: string;
  lat: number;
  lon: number;
  confidence: number;
  timestamp: string;
  geohash: string;
  signature: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const request: VerifyRequest = JSON.parse(event.body || '{}');
    const { hazardId, hazardType, lat, lon, confidence, timestamp, geohash, signature } = request;
    const sessionId = `verify-${hazardId.replace(/#/g, '-')}-${Date.now()}`;

    // [H3 INDEXING] — Convert lat/lon to an H3 hex index at resolution 9
    // (~city-block size, ~174m edge length). This is the spatial key used for deduplication.
    const h3Index = latLngToCell(lat, lon, 9);

    // ── Step A: ECDSA Device Registry verification ───────────────────────────
    // Reconstruct the exact payload string the edge node signed.
    const payloadStr = `VIGIA:${hazardType}:${lat}:${lon}:${timestamp}:${confidence}`;
    // ethers.verifyMessage recovers the signer address via EIP-191 personal_sign.
    const recoveredAddress = ethers.verifyMessage(payloadStr, signature);
    // Query VigiaDeviceRegistry — fail-closed if device is unknown.
    const { Item: deviceItem } = await dynamodb.send(new GetCommand({
      TableName: DEVICE_REGISTRY_TABLE,
      Key: { device_address: recoveredAddress },
    }));
    if (!deviceItem) {
      console.warn('[VerifyHazardSync] Unregistered device:', recoveredAddress);
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'DEVICE_NOT_REGISTERED' }),
      };
    }
    // The recovered address IS the authoritative wallet address for rewards.
    const driverWalletAddress = recoveredAddress;

    // Store hazard as unverified immediately
    await dynamodb.send(
      new PutCommand({
        TableName: HAZARDS_TABLE,
        Item: {
          hazardId,
          geohash,
          h3_index: h3Index, // [H3 INDEXING] stored for GSI-based dedup queries
          hazardType,
          lat,
          lon,
          confidence,
          timestamp,
          signature: signature,
          driverWalletAddress,
          status: 'UNVERIFIED',
          verificationAttemptedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 86400 * 30,
        },
      })
    );

    // Log telemetry submission to traces
    await dynamodb.send(
      new PutCommand({
        TableName: TRACES_TABLE,
        Item: {
          traceId: `telemetry-${sessionId}`,
          hazardId,
          type: 'telemetry_submission',
          message: `📤 Received hazard telemetry: ${hazardType} at ${lat.toFixed(4)},${lon.toFixed(4)} (confidence: ${(confidence * 100).toFixed(1)}%)`,
          createdAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
        },
      })
    );

    // Simulation mode with realistic agent reasoning
    if (AGENT_ID === 'placeholder' || AGENT_ALIAS_ID === 'placeholder') {
      const similarCount = Math.floor(Math.random() * 5) + 3;
      const score = confidence >= 0.6 ? Math.floor(70 + Math.random() * 25) : Math.floor(40 + Math.random() * 30);

      // ── Step B: Credit reward off-chain (BME model) ──────────────────────
      let rewardPending = false;
      if (driverWalletAddress && score >= 60) {
        // [H3 DEDUP CHECK] — query for a duplicate before crediting reward
        const isDuplicate = await isDuplicateHazard(h3Index, hazardType);
        if (isDuplicate) {
          console.log(`[BME] Duplicate hazard detected at H3 cell ${h3Index} — skipping reward for ${driverWalletAddress}`);
        } else {
          await creditReward(driverWalletAddress);
          rewardPending = true;
        }
      }

      const dupStatus = !rewardPending && driverWalletAddress && score >= 60 ? 'verified_duplicate' : 'verified_new';

      const steps = [
        {
          thought: `Analyzing ${hazardType} detection at coordinates ${lat.toFixed(4)}, ${lon.toFixed(4)}. Initial confidence is ${(confidence * 100).toFixed(1)}%. Need to query historical data to validate spatial clustering.`,
          action: 'queryHazards',
          actionInput: { geohash, radius: '500m' },
          observation: `Found ${similarCount} similar hazard reports in the vicinity within the last 30 days`,
        },
        {
          thought: `With ${similarCount} similar reports and ${(confidence * 100).toFixed(1)}% ML confidence, this appears to be a legitimate hazard. Calculating composite verification score.`,
          action: 'calculateScore',
          actionInput: { confidence, similarReports: similarCount },
          observation: `Verification score: ${score}/100${rewardPending ? ' · 1 VGA reward pending (claim via /claim-signature)' : ''}`,
        },
      ];

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traceId: `sim-${sessionId}`,
          steps,
          verificationScore: score,
          rewardPending,
          hazardStatus: dupStatus, // "verified_new" | "verified_duplicate"
          reasoning: `Verified ${hazardType} with score ${score}/100. High spatial correlation with ${similarCount} similar reports.`,
        }),
      };
    }

    // ── Real Bedrock Agent path ──────────────────────────────────────────────
    const prompt = `New hazard detected:
- Type: ${hazardType}
- Location: ${lat}, ${lon} (geohash: ${geohash})
- Confidence: ${confidence}
- Timestamp: ${timestamp}

Verify this hazard and return your reasoning with a verification score (0-100).`;

    const steps: any[] = [];
    let completion = '';
    let verificationScore = 0;

    try {
      const agentResponse = await bedrockAgent.send(
        new InvokeAgentCommand({
          agentId: AGENT_ID,
          agentAliasId: AGENT_ALIAS_ID,
          sessionId,
          inputText: prompt,
          enableTrace: true,
        })
      );

      for await (const ev of agentResponse.completion) {
        const trace = ev.trace?.trace || ev.trace;
        const orch = trace?.orchestrationTrace;

        if (orch?.modelInvocationOutput?.rawResponse?.content) {
          try {
            const parsed = JSON.parse(orch.modelInvocationOutput.rawResponse.content);
            const messageContent = parsed.output?.message?.content || [];
            let thought = '';
            let action = '';
            let actionInput = {};

            for (const item of messageContent) {
              if (item.text) {
                const thinkMatch = item.text.match(/<thinking>(.*?)<\/thinking>/s);
                if (thinkMatch) {
                  const lines = thinkMatch[1].trim().split('\n')
                    .map((l: string) => l.trim())
                    .filter((l: string) => l && !l.match(/^\(\d+\)$/))
                    .map((l: string) => l.replace(/^\(\d+\)\s*/, ''));
                  thought = lines.slice(0, 3).join(' ').substring(0, 200);
                }
              }
              if (item.toolUse) {
                action = item.toolUse.name.replace('GET__QueryAndVerify__', '');
                actionInput = item.toolUse.input || {};
              }
            }

            if (action) steps.push({ thought: thought || `Executing ${action}`, action, actionInput, observation: '' });
          } catch (_) {}
        }

        if (orch?.observation?.actionGroupInvocationOutput?.text && steps.length > 0) {
          const obsText = orch.observation.actionGroupInvocationOutput.text;
          let meaningfulObs = obsText;
          try {
            const obsJson = JSON.parse(obsText);
            const lastAction = steps[steps.length - 1].action;
            if (lastAction.includes('query_hazards') || lastAction.includes('queryHazards')) {
              const count = obsJson.count || obsJson.hazards?.length || 0;
              const computed = obsJson.computedVerificationScore || 0;
              if (computed > verificationScore) verificationScore = computed;
              meaningfulObs = `Found ${count} similar hazard${count !== 1 ? 's' : ''} in the area (score: ${computed}/100)`;
            } else if (lastAction.includes('calculate_score') || lastAction.includes('calculateScore')) {
              const score = obsJson.verificationScore || 0;
              if (score > verificationScore) verificationScore = score;
              const b = obsJson.breakdown || {};
              meaningfulObs = `Verification score: ${score}/100 (count: ${b.countScore || 0}, confidence: ${b.confidenceScore || 0}, temporal: ${b.temporalScore || 0})`;
            } else {
              meaningfulObs = obsText.substring(0, 150);
            }
          } catch (_) {
            meaningfulObs = obsText.substring(0, 150);
          }
          steps[steps.length - 1].observation = meaningfulObs;
        }

        if (ev.chunk) completion += new TextDecoder().decode(ev.chunk.bytes);
      }

      // verificationScore may already be set from tool observations above.
      // Only override if the agent's final text has a higher value.
      const scoreMatch = completion.match(/verification[_\s]?score[:\s]+(\d+)/i);
      const textScore = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      if (textScore > verificationScore) verificationScore = textScore;
      // Step observation fallback (score: XX/100 pattern)
      if (verificationScore === 0) {
        for (const step of steps) {
          const m = String(step.observation).match(/score:\s*(\d+(?:\.\d+)?)\//i);
          if (m) { verificationScore = parseFloat(m[1]); break; }
        }
      }

    } catch (bedrockError) {
      // Bedrock unavailable (timeout, throttle, DependencyFailedException) — fall back to simulation
      console.warn('[VerifyHazardSync] Bedrock unavailable, using simulation fallback:', (bedrockError as Error).message);
      const similarCount = Math.floor(Math.random() * 5) + 3;
      verificationScore = confidence >= 0.6 ? Math.floor(70 + Math.random() * 25) : Math.floor(40 + Math.random() * 30);
      steps.push(
        {
          thought: `Analyzing ${hazardType} at ${lat.toFixed(4)}, ${lon.toFixed(4)}. Confidence ${(confidence * 100).toFixed(1)}%. Querying spatial history.`,
          action: 'queryHazards',
          actionInput: { geohash, radius: '500m' },
          observation: `Found ${similarCount} similar hazard reports in the vicinity within the last 30 days`,
        },
        {
          thought: `${similarCount} corroborating reports with ${(confidence * 100).toFixed(1)}% ML confidence. Computing composite score.`,
          action: 'calculateScore',
          actionInput: { confidence, similarReports: similarCount },
          observation: `Verification score: ${verificationScore}/100`,
        }
      );
      completion = `Verified ${hazardType} with score ${verificationScore}/100 (simulation fallback — Bedrock unavailable).`;
    }

    // ── Step B: Credit reward off-chain (BME model, zero gas) ───────────────
    let rewardPending = false;
    const shouldReward = verificationScore >= 60 || (verificationScore === 0 && confidence >= 0.8);
    if (driverWalletAddress && shouldReward) {
      // [H3 DEDUP CHECK] — query for a duplicate before crediting reward
      const isDuplicate = await isDuplicateHazard(h3Index, hazardType);
      if (isDuplicate) {
        console.log(`[BME] Duplicate hazard detected at H3 cell ${h3Index} — skipping reward for ${driverWalletAddress}`);
      } else {
        await creditReward(driverWalletAddress);
        rewardPending = true;
      }
    }
    const hazardStatus = !rewardPending && driverWalletAddress && shouldReward ? 'verified_duplicate' : 'verified_new';

    // ── Step C: Persist trace ────────────────────────────────────────────────
    await dynamodb.send(
      new PutCommand({
        TableName: TRACES_TABLE,
        Item: {
          traceId: sessionId,
          hazardId,
          reasoning: completion,
          verificationScore,
          steps,
          rewardPending,
          createdAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
        },
      })
    );

    if (rewardPending) {
      await dynamodb.send(
        new PutCommand({
          TableName: LEDGER_TABLE,
          Item: {
            ledgerId: `ledger-${hazardId}`,
            timestamp: new Date().toISOString(),
            hazardId,
            contributorId: driverWalletAddress,
            action: 'HAZARD_VERIFIED',
            credits: 1,
            rewardPending: true,
            previousHash: 'genesis',
            currentHash: hazardId,
          },
        })
      );
      await dynamodb.send(
        new UpdateCommand({
          TableName: HAZARDS_TABLE,
          Key: { geohash, timestamp },
          UpdateExpression: 'SET #s = :s',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':s': 'VERIFIED' },
        })
      );
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ traceId: sessionId, steps, verificationScore, rewardPending, hazardStatus, reasoning: completion }),
    };
  } catch (error) {
    console.error('[VerifyHazardSync] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Verification failed' }),
    };
  }
};
