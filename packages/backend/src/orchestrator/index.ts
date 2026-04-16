import { DynamoDBStreamHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createHash, randomUUID } from 'crypto';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock  = new BedrockRuntimeClient({ region: 'us-east-1' });
const bedrockAgent = new BedrockAgentRuntimeClient({ region: 'us-east-1' });
const lambdaClient = new LambdaClient({});
const s3       = new S3Client({});

const COOLDOWN_TABLE  = process.env.COOLDOWN_TABLE_NAME!;
const TRACES_TABLE    = process.env.TRACES_TABLE_NAME!;
const HAZARDS_TABLE   = process.env.HAZARDS_TABLE_NAME!;
const LEDGER_TABLE    = process.env.LEDGER_TABLE_NAME!;
const REWARDS_TABLE   = process.env.REWARDS_LEDGER_TABLE_NAME!;
const FRAMES_BUCKET   = process.env.FRAMES_BUCKET_NAME!;
const AGENT_ID        = process.env.BEDROCK_AGENT_ID!;
const SLASH_FUNCTION  = process.env.SLASH_FUNCTION_NAME ?? '';
const AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID!;
const ONE_TOKEN      = BigInt('1000000000000000000');

async function countVerifiedAtGeohash(geohash: string): Promise<number> {
  const res = await dynamodb.send(new QueryCommand({
    TableName: HAZARDS_TABLE,
    IndexName: 'status-timestamp-index',
    KeyConditionExpression: '#s = :v',
    FilterExpression: 'geohash = :g',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':v': 'VERIFIED', ':g': geohash },
    Select: 'COUNT',
  }));
  return res.Count ?? 0;
}

// Returns true if this wallet was already rewarded for a VERIFIED hazard at this
// geohash within the last 30 days. Scans the ledger for matching contributorId + geohash.
const REWARD_LOCKOUT_SECONDS = 30 * 24 * 60 * 60; // 30 days
async function alreadyRewardedAt(geohash: string, walletAddress: string): Promise<boolean> {
  if (!walletAddress) return false;
  const cutoff = new Date(Date.now() - REWARD_LOCKOUT_SECONDS * 1000).toISOString();
  const res = await dynamodb.send(new QueryCommand({
    TableName: LEDGER_TABLE,
    IndexName: 'ContributorGeohashIndex',
    KeyConditionExpression: 'contributorId = :w AND geohash = :g',
    FilterExpression: '#ts > :cutoff',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
    ExpressionAttributeValues: { ':w': walletAddress, ':g': geohash, ':cutoff': cutoff },
    Limit: 1,
    Select: 'COUNT',
  }));
  return (res.Count ?? 0) > 0;
}

function calcScore(count: number, vlmConf: number) {
  const discoveryBonus = count === 0 ? 40 : Math.min(count * 10, 30);
  return { discoveryBonus, totalScore: discoveryBonus + vlmConf * 60 };
}

interface AgentResult {
  finalAnswer: string;
  reactSteps: Array<{ thought?: string; action?: string; actionInput?: Record<string, unknown>; observation?: string }>;
  verificationScore: number | null;
}

// Invoke the Bedrock Agent with VLM context as text input.
// Retries up to 3 times on transient model timeout errors.
async function invokeAgent(geohash: string, hazardType: string, vlmReasoning: string, vlmConfidence: number): Promise<AgentResult> {
  const prompt =
    `A dashcam frame was analysed by a vision model for a reported ${hazardType} at geohash ${geohash}.\n` +
    `VLM reasoning: "${vlmReasoning}"\n` +
    `VLM confidence: ${vlmConfidence.toFixed(2)}\n\n` +
    `Please verify this hazard: query existing hazards at geohash ${geohash}, calculate the verification score, and give your final verdict with reasoning.`;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const sessionId = `orch-${geohash}-${Date.now()}`;
      const reactSteps: AgentResult['reactSteps'] = [];
      let finalAnswer = '';
      let verificationScore: number | null = null;

      const response = await bedrockAgent.send(new InvokeAgentCommand({
        agentId: AGENT_ID,
        agentAliasId: AGENT_ALIAS_ID,
        sessionId,
        inputText: prompt,
        enableTrace: true,
      }));

      for await (const event of response.completion!) {
        if (event.trace?.trace?.orchestrationTrace) {
          const orch = event.trace.trace.orchestrationTrace;

          // Capture agent's reasoning (rationale field is the primary source)
          if (orch.rationale?.text) {
            reactSteps.push({ thought: orch.rationale.text });
          } else if (orch.modelInvocationInput?.text) {
            const thinking = orch.modelInvocationInput.text.match(/<thinking>([\s\S]*?)<\/thinking>/)?.[1]?.trim();
            if (thinking) reactSteps.push({ thought: thinking });
          }

          if (orch.invocationInput?.actionGroupInvocationInput) {
            const inv = orch.invocationInput.actionGroupInvocationInput;
            const lastStep = reactSteps[reactSteps.length - 1];
            const actionInput: Record<string, unknown> = {};
            inv.parameters?.forEach((p: any) => { actionInput[p.name] = p.value; });
            if (lastStep && !lastStep.action) { lastStep.action = inv.apiPath ?? inv.function ?? 'unknown'; lastStep.actionInput = actionInput; }
            else reactSteps.push({ action: inv.apiPath ?? inv.function ?? 'unknown', actionInput });
          }

          if (orch.observation?.actionGroupInvocationOutput?.text) {
            const obs = orch.observation.actionGroupInvocationOutput.text;
            const lastStep = reactSteps[reactSteps.length - 1];
            if (lastStep) lastStep.observation = obs;
            const scoreMatch = obs.match(/"verificationScore"\s*:\s*([\d.]+)/);
            if (scoreMatch) verificationScore = parseFloat(scoreMatch[1]);
          }

          if (orch.observation?.finalResponse?.text) finalAnswer = orch.observation.finalResponse.text;
        }
        if (event.chunk?.bytes) finalAnswer += new TextDecoder().decode(event.chunk.bytes);
      }

      console.log(`[Orch] Agent ReAct steps: ${reactSteps.length} | score from agent: ${verificationScore} (attempt ${attempt})`);
      return { finalAnswer, reactSteps, verificationScore };

    } catch (err: any) {
      const isTransient = err.message?.includes('timeout') || err.message?.includes('Dependency resource');
      console.warn(`[Orch] Agent attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (!isTransient || attempt === MAX_RETRIES) throw err;
      await new Promise(r => setTimeout(r, 2000 * attempt)); // 2s, 4s backoff
    }
  }
  throw new Error('Agent failed after all retries');
}

async function creditReward(walletAddress: string, hazardId: string) {
  await dynamodb.send(new UpdateCommand({
    TableName: REWARDS_TABLE,
    Key: { wallet_address: walletAddress },
    UpdateExpression: 'ADD pending_balance :amt, total_earned :amt SET last_updated = :now, nonce = if_not_exists(nonce, :zero), last_hazard_id = :hid',
    ExpressionAttributeValues: { ':amt': ONE_TOKEN as any, ':now': new Date().toISOString(), ':zero': 0, ':hid': hazardId },
  }));
}

export const handler = async (event: any) => {
  // EventBridge Pipes sends events as a flat array; DynamoDB Streams sends {Records: [...]}
  const records: any[] = Array.isArray(event) ? event : (event.Records ?? []);
  for (const record of records) {
    if (record.eventName !== 'INSERT') continue;
    const img = record.dynamodb?.NewImage;
    if (!img) continue;

    const geohash             = img.geohash.S!;
    const timestamp           = img.timestamp.S!;
    const hazardType          = img.hazardType.S!;
    const confidence          = parseFloat(img.confidence.N!);
    const driverWalletAddress = img.driverWalletAddress?.S ?? '';
    const s3_key              = img.s3_key?.S ?? null;
    const hazardId            = `${geohash}#${timestamp}`;
    const cooldownKey         = hazardId; // per-hazard dedup, not per-type

    const cooldown = await dynamodb.send(new GetCommand({ TableName: COOLDOWN_TABLE, Key: { cooldownKey } }));
    if (cooldown.Item) { console.log(`[Orch] SKIP cooldown active: ${cooldownKey}`); continue; }

    const traceId   = `orch-${geohash}-${Date.now()}`;
    const createdAt = new Date().toISOString();

    console.log(`[Orch] ── START hazardId=${hazardId} type=${hazardType} onnx=${confidence.toFixed(2)} s3_key=${s3_key ?? 'null'}`);

    // ── §3 Fail-Closed VLM Quarantine ────────────────────────────────────────
    let vlmConfidence: number;
    let vlmReasoning: string;

    try {
      if (!s3_key) throw new Error('No frame (s3_key is null)');

      console.log(`[Orch] S3 fetch: bucket=${FRAMES_BUCKET} key=${s3_key}`);
      const s3Obj    = await s3.send(new GetObjectCommand({ Bucket: FRAMES_BUCKET, Key: s3_key }));
      const imgBytes = Buffer.from(await s3Obj.Body!.transformToByteArray());
      console.log(`[Orch] S3 fetch OK: ${imgBytes.length} bytes`);

      console.log(`[Orch] Bedrock converse → amazon.nova-lite-v1:0`);
      const vlmRes = await bedrock.send(new ConverseCommand({
        modelId: 'amazon.nova-lite-v1:0',
        messages: [{
          role: 'user',
          content: [
            { image: { format: 'jpeg', source: { bytes: imgBytes } } },
            { text: 'Analyze this dashcam frame. Is this a genuine physical road hazard? Return your reasoning and a confidence float (0.0 to 1.0). Respond ONLY with valid JSON: {"reasoning": "...", "confidence": 0.8}' },
          ],
        }],
      }));

      const vlmText = (vlmRes.output?.message?.content?.[0] as any)?.text ?? '{}';
      console.log(`[Orch] VLM raw response: ${vlmText}`);
      const vlm     = JSON.parse(vlmText) as { reasoning: string; confidence: number };
      vlmConfidence = Math.max(0, Math.min(1, Number(vlm.confidence)));
      vlmReasoning  = vlm.reasoning ?? 'No reasoning provided';
      console.log(`[Orch] VLM parsed: confidence=${vlmConfidence.toFixed(3)} reasoning="${vlmReasoning}"`);

      // §3a: Explicit spoof detection — confidence < 0.1 means VLM is certain this is fake.
      // Trigger slash asynchronously (don't block the pipeline on the on-chain tx).
      if (vlmConfidence < 0.1 && driverWalletAddress && SLASH_FUNCTION) {
        console.log(`[Orch] SPOOF DETECTED — triggering slash for wallet=${driverWalletAddress}`);
        lambdaClient.send(new InvokeCommand({
          FunctionName: SLASH_FUNCTION,
          InvocationType: 'Event', // async — don't wait
          Payload: Buffer.from(JSON.stringify({
            walletAddress: driverWalletAddress,
            hazardId,
            reason: `VLM spoof detection: confidence=${vlmConfidence.toFixed(3)} reasoning="${vlmReasoning}"`,
          })),
        })).catch(e => console.error('[Orch] Slash invoke failed (non-blocking):', e.message));
      }

    } catch (err) {
      // §3: Any failure → quarantine. creditReward is NEVER called.
      console.error(`[Orch] VLM QUARANTINE hazardId=${hazardId} reason:`, (err as Error).message);
      await dynamodb.send(new UpdateCommand({
        TableName: HAZARDS_TABLE, Key: { geohash, timestamp },
        UpdateExpression: 'SET #s = :s',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': 'UNVERIFIED_VLM_FAILED' },
      }));
      await dynamodb.send(new PutCommand({
        TableName: TRACES_TABLE,
        Item: {
          traceId, hazardId,
          vlm_reasoning: 'VLM unavailable. Edge ONNX confidence recorded. Reward suspended.',
          vlm_confidence: null, onnx_confidence: confidence,
          discovery_bonus: null, total_score: null,
          verdict: 'UNVERIFIED_VLM_FAILED', createdAt,
          ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
        },
      }));
      await dynamodb.send(new PutCommand({
        TableName: COOLDOWN_TABLE,
        Item: { cooldownKey, processedAt: createdAt, ttl: Math.floor(Date.now() / 1000) + 30 },
      }));
      continue;
    }

    // ── §4 Agent Verification (ReAct) ────────────────────────────────────────
    console.log(`[Orch] Invoking Bedrock Agent for ReAct verification...`);
    const agentResult = await invokeAgent(geohash, hazardType, vlmReasoning, vlmConfidence);

    // Agent score takes precedence; fall back to deterministic formula if agent didn't return one
    const agentScore = agentResult.verificationScore;
    const discoveryBonus = agentScore == null ? (vlmConfidence >= 0.5 ? 40 : 0) : null;
    const totalScore = agentScore ?? (discoveryBonus! + vlmConfidence * 60);
    const verdict = totalScore >= 65 ? 'VERIFIED' : 'REJECTED';

    console.log(
      `[Orch] SCORE hazardId=${hazardId}` +
      ` | agent_score=${agentScore ?? 'n/a'}` +
      ` | vlm_confidence=${vlmConfidence.toFixed(3)}` +
      ` | total=${totalScore.toFixed(1)}/100` +
      ` | threshold=65` +
      ` | verdict=${verdict}` +
      ` | react_steps=${agentResult.reactSteps.length}`
    );

    await dynamodb.send(new UpdateCommand({
      TableName: HAZARDS_TABLE, Key: { geohash, timestamp },
      UpdateExpression: 'SET #s = :s, verificationScore = :score',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': verdict, ':score': Math.round(totalScore) },
    }));

    let rewardSkippedReason: string | null = null;

    if (verdict === 'VERIFIED') {
      const duplicate = await alreadyRewardedAt(geohash, driverWalletAddress);
      if (duplicate) {
        rewardSkippedReason = `Hazard at this location (geohash ${geohash}) was already rewarded to this contributor within the last 30 days.`;
        console.log(`[Orch] REWARD SKIP wallet=${driverWalletAddress} already rewarded at geohash=${geohash} within 30 days`);
      } else {
        if (driverWalletAddress) await creditReward(driverWalletAddress, hazardId);
      }
      const entry = { ledgerId: `ledger-${hazardId}`, timestamp: createdAt, contributorId: driverWalletAddress, hazardId, geohash, credits: duplicate ? 0 : 1, previousHash: '0'.repeat(64) };
      await dynamodb.send(new PutCommand({
        TableName: LEDGER_TABLE,
        Item: { ...entry, currentHash: createHash('sha256').update(JSON.stringify(entry)).digest('hex') },
      }));
    }

    await dynamodb.send(new PutCommand({
      TableName: TRACES_TABLE,
      Item: {
        traceId, hazardId,
        vlm_reasoning: vlmReasoning,
        vlm_confidence: vlmConfidence,
        onnx_confidence: confidence,
        agent_final_answer: agentResult.finalAnswer,
        react_steps: agentResult.reactSteps,
        discovery_bonus: discoveryBonus,
        total_score: Math.round(totalScore),
        verdict, createdAt,
        ...(rewardSkippedReason && { reward_skipped_reason: rewardSkippedReason }),
        ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
      },
    }));

    await dynamodb.send(new PutCommand({
      TableName: COOLDOWN_TABLE,
      Item: { cooldownKey, processedAt: createdAt, ttl: Math.floor(Date.now() / 1000) + 30 },
    }));

    console.log(`[Orch] ── DONE hazardId=${hazardId} verdict=${verdict} traceId=${traceId}`);
  }
};
