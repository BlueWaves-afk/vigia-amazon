import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const sessionId = event.queryStringParameters?.sessionId || 'current-session';

    // Query latest metrics for session
    const result = await docClient.send(new QueryCommand({
      TableName: process.env.ECONOMIC_METRICS_TABLE!,
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: {
        ':sessionId': sessionId,
      },
      ScanIndexForward: false,
      Limit: 1,
    }));

    if (!result.Items || result.Items.length === 0) {
      // Return default metrics if none exist
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          timestamp: Date.now(),
          totalHazardsDetected: 0,
          totalEstimatedRepairCost: 0,
          totalPreventedDamageCost: 0,
          roiMultiplier: 0,
          hazardBreakdown: {
            POTHOLE: { count: 0, avgCost: 0 },
            DEBRIS: { count: 0, avgCost: 0 },
            FLOODING: { count: 0, avgCost: 0 },
          },
        }),
      };
    }

    const metrics = result.Items[0];

    // Calculate ROI multiplier
    const roiMultiplier = metrics.totalEstimatedRepairCost > 0
      ? Number((metrics.totalPreventedDamageCost / metrics.totalEstimatedRepairCost).toFixed(2))
      : 0;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...metrics,
        roiMultiplier,
      }),
    };
  } catch (error) {
    console.error('[EconomicMetricsQuery] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
