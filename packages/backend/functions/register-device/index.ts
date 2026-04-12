import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const REGISTRY_TABLE = process.env.DEVICE_REGISTRY_TABLE_NAME!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const { device_address } = JSON.parse(event.body || '{}');

    // Validate Ethereum address format
    if (!device_address || !/^0x[0-9a-fA-F]{40}$/.test(device_address)) {
      return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'INVALID_ADDRESS' }) };
    }

    try {
      // Idempotent write — no error if device already registered
      await dynamodb.send(new PutCommand({
        TableName: REGISTRY_TABLE,
        Item: { device_address, registered_at: new Date().toISOString() },
        ConditionExpression: 'attribute_not_exists(device_address)',
      }));
      return { statusCode: 201, headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'registered', device_address }) };
    } catch (e: any) {
      if (e.name === 'ConditionalCheckFailedException') {
        return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'already_registered', device_address }) };
      }
      throw e;
    }
  } catch (error) {
    console.error('[RegisterDevice] Error:', error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
