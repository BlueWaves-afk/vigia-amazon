import { DynamoDBStreamHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { createHash } from 'crypto';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const bedrockAgent = new BedrockAgentRuntimeClient({});

const COOLDOWN_TABLE = process.env.COOLDOWN_TABLE_NAME!;
const TRACES_TABLE = process.env.TRACES_TABLE_NAME!;
const HAZARDS_TABLE = process.env.HAZARDS_TABLE_NAME!;
const LEDGER_TABLE = process.env.LEDGER_TABLE_NAME!;
const AGENT_ID = process.env.BEDROCK_AGENT_ID!;
const AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID!;

function hashContributorId(signature: string): string {
  return createHash('sha256').update(signature).digest('hex').substring(0, 16);
}

async function parseAgentResponse(response: any): Promise<any> {
  // Parse Bedrock Agent streaming response
  let completion = '';
  
  for await (const event of response.completion) {
    if (event.chunk) {
      const chunk = new TextDecoder().decode(event.chunk.bytes);
      completion += chunk;
    }
  }

  // Extract verification score from response
  const scoreMatch = completion.match(/verification[_\s]?score[:\s]+(\d+)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

  return {
    traceId: response.sessionId,
    reasoning: completion,
    verificationScore: score,
  };
}

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') continue;

    const newImage = record.dynamodb?.NewImage;
    if (!newImage) continue;

    const geohash = newImage.geohash.S!;
    const hazardType = newImage.hazardType.S!;
    const timestamp = newImage.timestamp.S!;
    const lat = parseFloat(newImage.lat.N!);
    const lon = parseFloat(newImage.lon.N!);
    const confidence = parseFloat(newImage.confidence.N!);
    const signature = newImage.signature.S!;

    const cooldownKey = `${geohash}#${hazardType}`;

    try {
      // Check cooldown
      const cooldownResponse = await dynamodb.send(
        new GetCommand({
          TableName: COOLDOWN_TABLE,
          Key: { cooldownKey },
        })
      );

      if (cooldownResponse.Item) {
        console.log(`Skipping duplicate hazard: ${cooldownKey}`);
        continue;
      }

      // Invoke Bedrock Agent (skip if placeholder IDs)
      let result;
      
      if (AGENT_ID === 'placeholder' || AGENT_ALIAS_ID === 'placeholder') {
        console.log('[Orchestrator] Bedrock Agent not configured, auto-verifying hazard');
        result = {
          traceId: `auto-${geohash}-${Date.now()}`,
          reasoning: `Auto-verified: ${hazardType} at ${lat},${lon} with confidence ${confidence}`,
          verificationScore: confidence >= 0.6 ? 80 : 50,
        };
      } else {
        const prompt = `New hazard detected:
- Type: ${hazardType}
- Location: ${lat}, ${lon} (geohash: ${geohash})
- Confidence: ${confidence}
- Timestamp: ${timestamp}

Verify this hazard and return your reasoning with a verification score (0-100).`;

        const agentResponse = await bedrockAgent.send(
          new InvokeAgentCommand({
            agentId: AGENT_ID,
            agentAliasId: AGENT_ALIAS_ID,
            sessionId: `session-${geohash}-${Date.now()}`,
            inputText: prompt,
          })
        );

        result = await parseAgentResponse(agentResponse);
      }

      // Update hazard status if verified
      if (result.verificationScore >= 70) {
        await dynamodb.send(
          new UpdateCommand({
            TableName: HAZARDS_TABLE,
            Key: { geohash, timestamp },
            UpdateExpression: 'SET #status = :verified, verificationScore = :score',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':verified': 'verified',
              ':score': result.verificationScore,
            },
          })
        );

        // Write to DePIN ledger - get last entry
        const ledgerResponse = await dynamodb.send(
          new GetCommand({
            TableName: LEDGER_TABLE,
            Key: { ledgerId: 'ledger', timestamp: '9999-12-31T23:59:59.999Z' }, // Get latest by querying with max timestamp
          })
        );

        const previousHash = ledgerResponse.Item?.currentHash || '0'.repeat(64);

        const ledgerEntry = {
          ledgerId: 'ledger',
          timestamp: new Date().toISOString(),
          contributorId: hashContributorId(signature),
          hazardId: `${geohash}#${timestamp}`,
          credits: 5,
          previousHash,
        };

        const currentHash = createHash('sha256')
          .update(JSON.stringify(ledgerEntry))
          .digest('hex');

        await dynamodb.send(
          new PutCommand({
            TableName: LEDGER_TABLE,
            Item: { ...ledgerEntry, currentHash },
          })
        );
      }

      // Store reasoning trace
      await dynamodb.send(
        new PutCommand({
          TableName: TRACES_TABLE,
          Item: {
            traceId: result.traceId,
            hazardId: `${geohash}#${timestamp}`,
            reasoning: result.reasoning,
            verificationScore: result.verificationScore,
            createdAt: new Date().toISOString(),
            ttl: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
          },
        })
      );

      // Write cooldown entry
      await dynamodb.send(
        new PutCommand({
          TableName: COOLDOWN_TABLE,
          Item: {
            cooldownKey,
            processedAt: new Date().toISOString(),
            ttl: Math.floor(Date.now() / 1000) + 300, // 5 minutes
          },
        })
      );

      console.log(`Processed hazard: ${cooldownKey}, score: ${result.verificationScore}`);
    } catch (error) {
      console.error(`Error processing hazard ${cooldownKey}:`, error);
    }
  }
};
