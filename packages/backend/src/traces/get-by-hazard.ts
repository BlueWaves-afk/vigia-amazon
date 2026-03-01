import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

/**
 * GET /traces/{hazardId}
 * 
 * Fetches the agent trace for a specific hazard ID.
 * Returns 404 if trace not found (agent hasn't processed yet).
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('[GetByHazard] Event:', JSON.stringify(event));
  
  const hazardIdEncoded = event.pathParameters?.hazardId;
  const hazardId = hazardIdEncoded ? decodeURIComponent(hazardIdEncoded) : undefined;
  
  console.log('[GetByHazard] Encoded hazardId:', hazardIdEncoded);
  console.log('[GetByHazard] Decoded hazardId:', hazardId);

  if (!hazardId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Missing hazardId parameter' }),
    };
  }

  try {
    console.log('[GetByHazard] Querying table:', process.env.TRACES_TABLE_NAME);
    
    // Query traces table by hazardId
    const response = await dynamodb.send(
      new QueryCommand({
        TableName: process.env.TRACES_TABLE_NAME,
        IndexName: 'HazardIdIndex', // GSI on hazardId
        KeyConditionExpression: 'hazardId = :hazardId',
        ExpressionAttributeValues: {
          ':hazardId': hazardId,
        },
        Limit: 1,
        ScanIndexForward: false, // Most recent first
      })
    );

    console.log('[GetByHazard] Query result:', JSON.stringify(response));
    
    const trace = response.Items?.[0];

    if (!trace) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Trace not found',
          message: 'Agent has not processed this hazard yet'
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ trace }),
    };
  } catch (error) {
    console.error('Error fetching trace:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to fetch trace' }),
    };
  }
};
