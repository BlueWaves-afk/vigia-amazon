import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BASE_COSTS: Record<string, number> = {
  POTHOLE: 150,
  DEBRIS: 50,
  FLOODING: 1000,
  ACCIDENT: 0,
};

const PREVENTED_DAMAGE: Record<string, number> = {
  POTHOLE: 300,
  DEBRIS: 150,
  FLOODING: 2000,
  ACCIDENT: 5000,
};

function calculateRepairCost(type: string, severity: number): number {
  const baseCost = BASE_COSTS[type] || 0;
  return Math.round(baseCost * (1 + severity * 0.2));
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { hazardId, geohash, type, severity, reportedBy, notes, signature } = body;

    if (!hazardId || !geohash || !type || !severity || !reportedBy || !signature) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // TODO: Verify ECDSA signature
    // const isValid = await verifyECDSA(signature, hazardId);
    // if (!isValid) {
    //   return { statusCode: 403, body: JSON.stringify({ error: 'Invalid signature' }) };
    // }

    const reportId = randomUUID();
    const reportedAt = Date.now();
    const estimatedCost = calculateRepairCost(type, severity);

    // Save to MaintenanceQueue
    await docClient.send(new PutCommand({
      TableName: process.env.MAINTENANCE_QUEUE_TABLE!,
      Item: {
        reportId,
        hazardId,
        geohash,
        type,
        severity,
        reportedBy,
        reportedAt,
        estimatedCost,
        status: 'PENDING',
        notes: notes || undefined,
        signature,
      },
    }));

    // Update EconomicMetrics (simplified - should use DynamoDB Streams in production)
    const sessionId = 'current-session'; // TODO: Get from context
    const preventedDamage = PREVENTED_DAMAGE[type] || 0;

    try {
      await docClient.send(new UpdateCommand({
        TableName: process.env.ECONOMIC_METRICS_TABLE!,
        Key: { sessionId, timestamp: Date.now() },
        UpdateExpression: 'ADD totalHazardsDetected :one, totalEstimatedRepairCost :cost, totalPreventedDamageCost :prevented',
        ExpressionAttributeValues: {
          ':one': 1,
          ':cost': estimatedCost,
          ':prevented': preventedDamage,
        },
      }));
    } catch (error) {
      console.warn('[MaintenanceReportHandler] Failed to update metrics:', error);
    }

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, estimatedCost }),
    };
  } catch (error) {
    console.error('[MaintenanceReportHandler] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
