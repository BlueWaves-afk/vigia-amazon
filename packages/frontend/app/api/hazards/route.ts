import { NextRequest, NextResponse } from 'next/server';
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

const HAZARDS_TABLE =
  process.env.HAZARDS_TABLE_NAME;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lon = parseFloat(searchParams.get('lon') || '0');
    const radius = parseInt(searchParams.get('radius') || '50000'); // 50km default

    // Scan hazards table
    const result = await docClient.send(new ScanCommand({
      TableName: HAZARDS_TABLE,
      Limit: 500,
    }));

    const hazards = (result.Items || [])
      .filter(h => {
        const distance = calculateDistance(lat, lon, h.lat, h.lon);
        return distance <= radius;
      })
      .map(h => ({
        lat: h.lat,
        lon: h.lon,
        hazardType: h.hazardType,
        status: h.status,
        confidence: h.confidence,
        timestamp: h.timestamp,
      }));

    return NextResponse.json({ hazards });
  } catch (error) {
    const awsError = normalizeAwsError(error);
    console.error('[hazards] Failed to fetch hazards', {
      ...awsError,
      region,
      tableName: HAZARDS_TABLE,
    });

    const debugDetails =
      process.env.DEBUG_API_ERRORS === 'true' || process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      {
        error: 'Failed to fetch hazards',
        hazards: [],
        errorType: awsError.errorType,
        requestId: awsError.requestId,
        ...(debugDetails ? { details: awsError } : {}),
      },
      { status: 500 }
    );
  }
}
