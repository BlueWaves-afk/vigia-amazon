import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const SESSION_FILES_TABLE = process.env.SESSION_FILES_TABLE!;
const LEDGER_ENTRIES_TABLE = process.env.LEDGER_ENTRIES_TABLE!;

interface SessionData {
  userId: string;
  geohash7: string;
  timestamp: string;
  hazardCount: number;
  verifiedCount: number;
  contributorId: string;
  status: 'draft' | 'finalized' | 'archived';
  location?: {
    continent?: string;
    country?: string;
    region?: string;
    city?: string;
  };
  hazards: any[];
  metadata?: any;
}

function computeHash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

async function getParentHash(userId: string, geohash7: string): Promise<string> {
  const result = await docClient.send(new QueryCommand({
    TableName: SESSION_FILES_TABLE,
    IndexName: 'geohash7-timestamp-index',
    KeyConditionExpression: 'geohash7 = :geohash',
    ExpressionAttributeValues: { ':geohash': geohash7 },
    ScanIndexForward: false,
    Limit: 1,
  }));

  return result.Items?.[0]?.fileHash || 'genesis';
}

async function writeLedgerEntry(sessionId: string, action: string, contributorId: string, previousHash: string) {
  const timestamp = new Date().toISOString();
  const payload = `${timestamp}${sessionId}${action}${previousHash}${contributorId}`;
  const currentHash = computeHash(payload);

  await docClient.send(new PutCommand({
    TableName: LEDGER_ENTRIES_TABLE,
    Item: {
      ledgerId: 'ledger',
      timestamp,
      sessionId,
      action,
      previousHash,
      currentHash,
      contributorId,
    },
  }));
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, pathParameters, body } = event;

  try {
    switch (httpMethod) {
      case 'POST': {
        // Create session
        const data: SessionData = JSON.parse(body || '{}');
        const sessionId = `${data.geohash7}#${data.timestamp}`;
        
        const payload = `${sessionId}${data.geohash7}${data.timestamp}${data.hazardCount}${data.verifiedCount}${data.contributorId}`;
        const fileHash = computeHash(payload);
        const parentHash = await getParentHash(data.userId, data.geohash7);

        const session = {
          userId: data.userId,
          sessionId,
          geohash7: data.geohash7,
          timestamp: data.timestamp,
          hazardCount: data.hazardCount,
          verifiedCount: data.verifiedCount,
          contributorId: data.contributorId,
          fileHash,
          parentHash,
          status: data.status || 'draft',
          location: data.location || {},
          hazards: data.hazards,
          metadata: data.metadata || {},
          ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days
        };

        await docClient.send(new PutCommand({
          TableName: SESSION_FILES_TABLE,
          Item: session,
        }));

        await writeLedgerEntry(sessionId, 'created', data.contributorId, parentHash);

        return {
          statusCode: 201,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(session),
        };
      }

      case 'GET': {
        if (pathParameters?.sessionId) {
          // Get single session
          const userId = event.queryStringParameters?.userId || 'default';
          const result = await docClient.send(new GetCommand({
            TableName: SESSION_FILES_TABLE,
            Key: { userId, sessionId: pathParameters.sessionId },
          }));

          if (!result.Item) {
            return {
              statusCode: 404,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ error: 'Session not found' }),
            };
          }

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(result.Item),
          };
        } else {
          // List sessions
          const userId = event.queryStringParameters?.userId || 'default';
          const result = await docClient.send(new QueryCommand({
            TableName: SESSION_FILES_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: { ':userId': userId },
            Limit: 100,
          }));

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ sessions: result.Items || [] }),
          };
        }
      }

      case 'PUT': {
        // Update session
        const data = JSON.parse(body || '{}');
        const userId = data.userId || 'default';
        const sessionId = pathParameters?.sessionId!;

        await docClient.send(new UpdateCommand({
          TableName: SESSION_FILES_TABLE,
          Key: { userId, sessionId },
          UpdateExpression: 'SET #status = :status, verifiedCount = :verifiedCount',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': data.status,
            ':verifiedCount': data.verifiedCount,
          },
        }));

        await writeLedgerEntry(sessionId, 'updated', data.contributorId, data.fileHash);

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true }),
        };
      }

      case 'DELETE': {
        // Delete session
        const userId = event.queryStringParameters?.userId || 'default';
        const sessionId = decodeURIComponent(pathParameters?.sessionId || '');

        console.log('Deleting session:', { userId, sessionId });

        await docClient.send(new DeleteCommand({
          TableName: SESSION_FILES_TABLE,
          Key: { userId, sessionId },
        }));

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true }),
        };
      }

      default:
        return {
          statusCode: 405,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
    };
  }
}
