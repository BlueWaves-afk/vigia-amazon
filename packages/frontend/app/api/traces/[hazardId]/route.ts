import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1' }));
export async function GET(_req: NextRequest, context: { params: Promise<{ hazardId: string }> }) {
  try {
    const TRACES_TABLE = process.env.TRACES_TABLE_NAME;
    const { hazardId } = await context.params;
    console.log(`[/api/traces] Querying hazardId=${hazardId} table=${TRACES_TABLE}`);
    const res = await dynamodb.send(new QueryCommand({
      TableName: TRACES_TABLE,
      IndexName: 'HazardIdIndex',
      KeyConditionExpression: 'hazardId = :id',
      ExpressionAttributeValues: { ':id': hazardId },
      Limit: 1,
      ScanIndexForward: false,
    }));
    const trace = res.Items?.[0] ?? null;
    console.log(`[/api/traces] Result for ${hazardId}: ${trace ? `found verdict=${trace.verdict} score=${trace.total_score}` : 'NOT FOUND'}`);
    return NextResponse.json({ trace });
  } catch (e) {
    console.error('[/api/traces] Error:', e);
    return NextResponse.json({ trace: null }, { status: 500 });
  }
}
