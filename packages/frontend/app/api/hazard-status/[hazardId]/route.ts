import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1' }));
export async function GET(_req: NextRequest, context: { params: Promise<{ hazardId: string }> }) {
  try {
    const HAZARDS_TABLE = process.env.HAZARDS_TABLE_NAME;
    const { hazardId } = await context.params;
    const [geohash, timestamp] = hazardId.split('#');
    if (!geohash || !timestamp) return NextResponse.json({ status: null }, { status: 400 });

    const res = await dynamodb.send(new GetCommand({
      TableName: HAZARDS_TABLE,
      Key: { geohash, timestamp },
      ProjectionExpression: '#s',
      ExpressionAttributeNames: { '#s': 'status' },
    }));
    return NextResponse.json({ status: res.Item?.status ?? null });
  } catch (e) {
    console.error('[/api/hazard-status] Error:', e);
    return NextResponse.json({ status: null }, { status: 500 });
  }
}
