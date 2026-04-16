import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

function getAwsRegion() {
  return (
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    process.env.NEXT_PUBLIC_AWS_REGION ||
    'us-east-1'
  );
}

function normalizeAwsError(err: unknown) {
  const anyErr = err as any;
  const name = anyErr?.name ?? 'UnknownError';
  const message = anyErr?.message ?? String(err);
  const requestId = anyErr?.$metadata?.requestId;
  const httpStatusCode = anyErr?.$metadata?.httpStatusCode;

  let errorType:
    | 'aws_credentials'
    | 'aws_access_denied'
    | 'aws_resource_not_found'
    | 'aws_invalid_token'
    | 'aws_throttling'
    | 'unknown' = 'unknown';

  if (name.includes('Credentials') || /Could not load credentials/i.test(message)) {
    errorType = 'aws_credentials';
  } else if (name === 'AccessDeniedException' || /AccessDenied/i.test(message) || httpStatusCode === 403) {
    errorType = 'aws_access_denied';
  } else if (name === 'ResourceNotFoundException') {
    errorType = 'aws_resource_not_found';
  } else if (name === 'UnrecognizedClientException' || /invalid security token/i.test(message)) {
    errorType = 'aws_invalid_token';
  } else if (name === 'ThrottlingException' || httpStatusCode === 429) {
    errorType = 'aws_throttling';
  }

  return { name, message, requestId, httpStatusCode, errorType };
}

const region = getAwsRegion();
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

export async function GET() {
  const TABLES = {
    hazards:     process.env.HAZARDS_TABLE_NAME,
    ledger:      process.env.LEDGER_TABLE_NAME,
    traces:      process.env.TRACES_TABLE_NAME,
    maintenance: process.env.MAINTENANCE_TABLE_NAME,
  };
  try {
    // Fetch hazards
    const hazardsResult = await docClient.send(new ScanCommand({
      TableName: TABLES.hazards,
      Select: 'ALL_ATTRIBUTES',
      Limit: 1000,
    }));

    const hazards = hazardsResult.Items || [];
    const totalHazards = hazards.length;
    const verifiedHazards = hazards.filter(h => h.status === 'VERIFIED').length;
    const pendingHazards = totalHazards - verifiedHazards;

    // Count unique contributors (DePIN nodes)
    const uniqueContributors = new Set(hazards.map(h => h.contributorId).filter(Boolean));
    const activeNodes = uniqueContributors.size;

    // Count critical hazards (ACCIDENT type or high verification score)
    const criticalHazards = hazards.filter(h => 
      h.hazardType === 'ACCIDENT' || (h.verificationScore && h.verificationScore > 80)
    ).length;

    // Calculate average verification score
    const scoresWithValues = hazards.filter(h => h.verificationScore).map(h => Number(h.verificationScore));
    const avgVerificationScore = scoresWithValues.length > 0
      ? Math.round(scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length)
      : 0;

    // Count unique geohashes for coverage
    const uniqueGeohashes = new Set(hazards.map(h => h.geohash).filter(Boolean));
    const coverageAreaKm2 = uniqueGeohashes.size * 25; // Each geohash ~25km²

    // Recent activity (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const recentActivity = hazards.filter(h => h.timestamp && h.timestamp > oneDayAgo).length;

    // Hazard type distribution
    const hazardTypes = {
      POTHOLE: hazards.filter(h => h.hazardType === 'POTHOLE').length,
      DEBRIS: hazards.filter(h => h.hazardType === 'DEBRIS').length,
      ACCIDENT: hazards.filter(h => h.hazardType === 'ACCIDENT').length,
      ANIMAL: hazards.filter(h => h.hazardType === 'ANIMAL').length,
    };

    // Fetch ledger count
    const ledgerResult = await docClient.send(new ScanCommand({
      TableName: TABLES.ledger,
      Select: 'COUNT',
    }));
    const ledgerEntries = ledgerResult.Count || 0;

    // Fetch maintenance queue
    const maintenanceResult = await docClient.send(new ScanCommand({
      TableName: TABLES.maintenance,
      Select: 'ALL_ATTRIBUTES',
      Limit: 100,
    }));
    const maintenanceReports = maintenanceResult.Items || [];
    const pendingMaintenance = maintenanceReports.filter(r => r.status === 'PENDING').length;

    return NextResponse.json({
      hazards: {
        total: totalHazards,
        verified: verifiedHazards,
        pending: pendingHazards,
        critical: criticalHazards,
        avgVerificationScore,
        types: hazardTypes,
      },
      network: {
        activeNodes,
        coverageAreaKm2,
        uniqueGeohashes: uniqueGeohashes.size,
        recentActivity,
      },
      ledger: {
        totalEntries: ledgerEntries,
      },
      maintenance: {
        totalReports: maintenanceReports.length,
        pending: pendingMaintenance,
      },
    });
  } catch (error) {
    const awsError = normalizeAwsError(error);
    console.error('[metrics/dashboard] Failed to fetch dashboard metrics', {
      ...awsError,
      region,
    });

    const debugDetails =
      process.env.DEBUG_API_ERRORS === 'true' || process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      {
        error: 'Failed to fetch metrics',
        errorType: awsError.errorType,
        requestId: awsError.requestId,
        ...(debugDetails ? { details: awsError } : {}),
      },
      { status: 500 }
    );
  }
}
