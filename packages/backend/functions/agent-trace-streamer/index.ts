import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // For SSE, we need to return proper headers
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    };

    // Simulate streaming ReAct traces
    // TODO: Replace with actual Bedrock Agent streaming
    const mockTraces = generateMockTraces(3);

    let body = '';
    for (const trace of mockTraces) {
      // Store in DynamoDB
      await docClient.send(new PutCommand({
        TableName: process.env.TRACES_TABLE_NAME!,
        Item: {
          ...trace,
          ttl: Math.floor(Date.now() / 1000) + 604800, // 7 days TTL
        },
      }));

      // Format as SSE
      body += `data: ${JSON.stringify(trace)}\n\n`;
    }

    return {
      statusCode: 200,
      headers,
      body,
    };
  } catch (error) {
    console.error('[AgentTraceStreamer] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

function generateMockTraces(count: number) {
  const traces = [];
  for (let i = 0; i < count; i++) {
    traces.push({
      traceId: randomUUID(),
      timestamp: Date.now() + i * 1000,
      geohash: '7tg3v2k',
      contributorId: `contributor-${Math.floor(Math.random() * 100)}`,
      steps: [
        {
          thought: 'Multiple reports of POTHOLE detected at geohash 7tg3v2k',
          action: 'query_dynamodb_history',
          actionInput: { geohash: '7tg3v2k' },
          observation: 'Found 2 prior reports in the last 24 hours',
        },
        {
          thought: 'Need to verify signature authenticity',
          action: 'verify_ecdsa_signature',
          actionInput: { signature: '0xabc...def' },
          observation: 'Valid signature from Contributor #42',
        },
        {
          thought: 'Hazard meets verification threshold',
          action: 'update_ledger',
          actionInput: { hazardId: randomUUID(), status: 'verified' },
          observation: 'Ledger updated successfully',
          finalAnswer: 'Hazard verified and added to Road Health Ledger. Rerouting affected nodes.',
        },
      ],
    });
  }
  return traces;
}
