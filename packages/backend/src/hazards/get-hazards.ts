import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const response = await dynamodb.send(
      new ScanCommand({
        TableName: process.env.HAZARDS_TABLE_NAME,
        Limit: 100,
      })
    );

    const items = response.Items || [];
    
    // Sort by timestamp descending (most recent first)
    const sorted = items.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        hazards: sorted,
        count: sorted.length,
      }),
    };
  } catch (error) {
    console.error('Error fetching hazards:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to fetch hazards' }),
    };
  }
};
