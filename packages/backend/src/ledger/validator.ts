import { APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const LEDGER_ENTRIES_TABLE = process.env.LEDGER_ENTRIES_TABLE!;

export async function handler(event: APIGatewayProxyEvent) {
  const sessionId = event.pathParameters?.sessionId;

  if (!sessionId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'sessionId is required' }),
    };
  }

  try {
    // Query ledger entries for session
    const result = await docClient.send(new QueryCommand({
      TableName: LEDGER_ENTRIES_TABLE,
      KeyConditionExpression: 'ledgerId = :ledgerId',
      FilterExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: {
        ':ledgerId': 'ledger',
        ':sessionId': sessionId,
      },
      ScanIndexForward: true, // Oldest first
    }));

    const entries = result.Items || [];

    // Validate hash chain
    for (let i = 0; i < entries.length; i++) {
      const current = entries[i];
      
      // Recompute hash
      const payload = `${current.timestamp}${current.sessionId}${current.action}${current.previousHash}${current.contributorId}`;
      const expectedHash = createHash('sha256').update(payload).digest('hex');

      if (current.currentHash !== expectedHash) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ valid: false, brokenAt: i, reason: 'Hash mismatch' }),
        };
      }

      // Check chain link
      if (i > 0) {
        const previous = entries[i - 1];
        if (current.previousHash !== previous.currentHash) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ valid: false, brokenAt: i, reason: 'Chain broken' }),
          };
        }
      } else {
        // First entry should have genesis
        if (current.previousHash !== 'genesis') {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ valid: false, brokenAt: 0, reason: 'Missing genesis' }),
          };
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ valid: true, entries: entries.length }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
    };
  }
}
