import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1' }));
const HAZARDS_TABLE = process.env.HAZARDS_TABLE_NAME;

export async function GET() {
  try {
    // Scan all hazards — we need wallet + lat/lon + timestamp
    const res = await dynamodb.send(new ScanCommand({
      TableName: HAZARDS_TABLE,
      ProjectionExpression: 'driverWalletAddress, lat, lon, #ts, #st, hazardType',
      ExpressionAttributeNames: { '#ts': 'timestamp', '#st': 'status' },
      Limit: 2000,
    }));

    const items = res.Items ?? [];

    // ── Active Nodes: last reported location per unique wallet ──────────────
    const walletMap = new Map<string, { lat: number; lon: number; timestamp: string; reportCount: number; lastHazardType: string }>();
    for (const item of items) {
      const wallet = item.driverWalletAddress as string;
      if (!wallet || wallet === '' || wallet === '0xTestWallet123' || wallet === '0xTestWallet456') continue;
      const existing = walletMap.get(wallet);
      if (!existing || item.timestamp > existing.timestamp) {
        walletMap.set(wallet, {
          lat: item.lat,
          lon: item.lon,
          timestamp: item.timestamp,
          reportCount: (existing?.reportCount ?? 0) + 1,
          lastHazardType: item.hazardType,
        });
      } else {
        existing.reportCount++;
      }
    }

    const nodes = Array.from(walletMap.entries()).map(([wallet, data]) => ({
      wallet: wallet.slice(0, 6) + '...' + wallet.slice(-4),
      lat: data.lat,
      lon: data.lon,
      lastSeen: data.timestamp,
      reportCount: data.reportCount,
      lastHazardType: data.lastHazardType,
    }));

    // ── Coverage Points: all VERIFIED hazard locations ──────────────────────
    const coverage = items
      .filter(item => item.status === 'VERIFIED' && item.lat && item.lon)
      .map(item => ({ lat: item.lat, lon: item.lon, hazardType: item.hazardType }));

    return NextResponse.json({
      nodes,
      coverage,
      stats: {
        activeNodes: nodes.length,
        totalReports: items.length,
        verifiedCoverage: coverage.length,
      },
    }, { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } });
  } catch (e: any) {
    console.error('[/api/network-nodes]', e.message);
    return NextResponse.json({ nodes: [], coverage: [], stats: { activeNodes: 0, totalReports: 0, verifiedCoverage: 0 } }, { status: 500 });
  }
}
