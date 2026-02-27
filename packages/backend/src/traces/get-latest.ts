import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const response = await dynamodb.send(
      new ScanCommand({
        TableName: process.env.TRACES_TABLE_NAME,
        Limit: 1,
      })
    );

    const items = response.Items || [];
    
    // Sort by createdAt descending (most recent first)
    const sorted = items.sort((a, b) => 
      new Date(b.createdAt || b.timestamp || 0).getTime() - 
      new Date(a.createdAt || a.timestamp || 0).getTime()
    );

    const latestTrace = sorted[0] || null;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        trace: latestTrace,
        hasData: !!latestTrace,
      }),
    };
  } catch (error) {
    console.error('Error fetching traces:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to fetch traces' }),
    };
  }
};
