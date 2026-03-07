import { NextRequest } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const RATE_LIMIT_HOUR_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 30;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: string; retryAfterMs: number };

function getAwsRegion() {
  return (
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    process.env.NEXT_PUBLIC_AWS_REGION ||
    'us-east-1'
  );
}

function getRateLimitTableName(): string | undefined {
  return (
    process.env.AGENT_RATE_LIMIT_TABLE_NAME ||
    process.env.VIGIA_AGENT_RATE_LIMIT_TABLE_NAME ||
    process.env.RATE_LIMIT_TABLE_NAME ||
    undefined
  );
}

function bucketStartMs(nowMs: number, windowMs: number) {
  return Math.floor(nowMs / windowMs) * windowMs;
}

function ttlSecondsForWindow(bucketStart: number, windowMs: number) {
  // Keep the record around slightly past the bucket to tolerate clock skew.
  return Math.ceil((bucketStart + windowMs + 2 * 60 * 1000) / 1000);
}

function safeFirstForwardedFor(headerValue: string | null): string | undefined {
  if (!headerValue) return undefined;
  const first = headerValue.split(',')[0]?.trim();
  if (!first) return undefined;
  // Strip IPv4 port if present (e.g. "1.2.3.4:1234")
  return first.replace(/:\d+$/, '');
}

export function getClientIp(req: NextRequest): string {
  return (
    safeFirstForwardedFor(req.headers.get('x-forwarded-for')) ||
    safeFirstForwardedFor(req.headers.get('x-real-ip')) ||
    'unknown'
  );
}

// Fallback in-memory limiter (dev only). This is not reliable under serverless scaling.
const memoryStore = new Map<
  string,
  { minuteRequests: number[]; hourlyRequests: number[] }
>();

function checkMemoryRateLimit(ip: string): RateLimitResult {
  const now = Date.now();

  let entry = memoryStore.get(ip);
  if (!entry) {
    entry = { minuteRequests: [], hourlyRequests: [] };
    memoryStore.set(ip, entry);
  }

  entry.minuteRequests = entry.minuteRequests.filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  entry.hourlyRequests = entry.hourlyRequests.filter(
    (t) => now - t < RATE_LIMIT_HOUR_MS
  );

  if (entry.minuteRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = Math.min(...entry.minuteRequests);
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
    return {
      allowed: false,
      reason: `Rate limit: ${MAX_REQUESTS_PER_WINDOW} queries per minute`,
      retryAfterMs,
    };
  }

  if (entry.hourlyRequests.length >= MAX_REQUESTS_PER_HOUR) {
    const oldest = Math.min(...entry.hourlyRequests);
    const retryAfterMs = RATE_LIMIT_HOUR_MS - (now - oldest);
    return {
      allowed: false,
      reason: `Rate limit: ${MAX_REQUESTS_PER_HOUR} queries per hour`,
      retryAfterMs,
    };
  }

  entry.minuteRequests.push(now);
  entry.hourlyRequests.push(now);
  return { allowed: true };
}

let ddbDoc: DynamoDBDocumentClient | undefined;
function getDdbDocClient() {
  if (ddbDoc) return ddbDoc;
  const region = getAwsRegion();
  ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });
  return ddbDoc;
}

async function readCounts(tableName: string, keys: Array<{ pk: string }>) {
  const client = getDdbDocClient();
  const res = await client.send(
    new BatchGetCommand({
      RequestItems: {
        [tableName]: {
          Keys: keys,
          ProjectionExpression: '#pk,#count',
          ExpressionAttributeNames: {
            '#pk': 'pk',
            '#count': 'count',
          },
        },
      },
    })
  );

  const items = (res.Responses?.[tableName] ?? []) as Array<{
    pk: string;
    count?: number;
  }>;

  const byPk = new Map(items.map((i) => [i.pk, i.count ?? 0]));
  return keys.map((k) => byPk.get(k.pk) ?? 0);
}

export async function enforceAgentRateLimit(req: NextRequest): Promise<RateLimitResult> {
  const ip = getClientIp(req);

  const tableName = getRateLimitTableName();
  if (!tableName) {
    if (process.env.NODE_ENV === 'production') {
      // Do not silently fall back in production; it is bypassable under serverless scaling.
      return {
        allowed: false,
        reason: 'Rate limiting is not configured on the server. Please set AGENT_RATE_LIMIT_TABLE_NAME.',
        retryAfterMs: 10 * 1000,
      };
    }
    return checkMemoryRateLimit(ip);
  }

  const now = Date.now();
  const minuteBucket = bucketStartMs(now, RATE_LIMIT_WINDOW_MS);
  const hourBucket = bucketStartMs(now, RATE_LIMIT_HOUR_MS);

  const minuteKey = `agent#ip#${ip}#m#${minuteBucket}`;
  const hourKey = `agent#ip#${ip}#h#${hourBucket}`;

  const minuteTtl = ttlSecondsForWindow(minuteBucket, RATE_LIMIT_WINDOW_MS);
  const hourTtl = ttlSecondsForWindow(hourBucket, RATE_LIMIT_HOUR_MS);

  const client = getDdbDocClient();

  try {
    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: tableName,
              Key: { pk: minuteKey },
              UpdateExpression:
                'SET #count = if_not_exists(#count, :zero) + :inc, #ttl = :ttl',
              ConditionExpression:
                'attribute_not_exists(#count) OR #count < :max',
              ExpressionAttributeNames: {
                '#count': 'count',
                '#ttl': 'ttl',
              },
              ExpressionAttributeValues: {
                ':zero': 0,
                ':inc': 1,
                ':max': MAX_REQUESTS_PER_WINDOW,
                ':ttl': minuteTtl,
              },
            },
          },
          {
            Update: {
              TableName: tableName,
              Key: { pk: hourKey },
              UpdateExpression:
                'SET #count = if_not_exists(#count, :zero) + :inc, #ttl = :ttl',
              ConditionExpression:
                'attribute_not_exists(#count) OR #count < :max',
              ExpressionAttributeNames: {
                '#count': 'count',
                '#ttl': 'ttl',
              },
              ExpressionAttributeValues: {
                ':zero': 0,
                ':inc': 1,
                ':max': MAX_REQUESTS_PER_HOUR,
                ':ttl': hourTtl,
              },
            },
          },
        ],
      })
    );

    return { allowed: true };
  } catch (err: any) {
    const retryAfterMinuteMs = minuteBucket + RATE_LIMIT_WINDOW_MS - now;
    const retryAfterHourMs = hourBucket + RATE_LIMIT_HOUR_MS - now;

    // TransactionCanceledException is the expected path when either condition fails.
    if (err?.name === 'TransactionCanceledException') {
      try {
        const [minuteCount, hourCount] = await readCounts(tableName, [
          { pk: minuteKey },
          { pk: hourKey },
        ]);

        if (minuteCount >= MAX_REQUESTS_PER_WINDOW) {
          return {
            allowed: false,
            reason: `Rate limit: ${MAX_REQUESTS_PER_WINDOW} queries per minute`,
            retryAfterMs: Math.max(0, retryAfterMinuteMs),
          };
        }

        if (hourCount >= MAX_REQUESTS_PER_HOUR) {
          return {
            allowed: false,
            reason: `Rate limit: ${MAX_REQUESTS_PER_HOUR} queries per hour`,
            retryAfterMs: Math.max(0, retryAfterHourMs),
          };
        }
      } catch {
        // If reads fail, fall through to a generic minute-based retry.
      }

      // Default to the shortest retry window.
      return {
        allowed: false,
        reason: `Rate limit exceeded`,
        retryAfterMs: Math.max(0, Math.min(retryAfterMinuteMs, retryAfterHourMs)),
      };
    }

    console.error('[rate-limit] Unexpected limiter error', err);
    // Fail closed if the shared limiter is configured but unhealthy.
    return {
      allowed: false,
      reason: 'Rate limiting is temporarily unavailable. Please try again shortly.',
      retryAfterMs: 10 * 1000,
    };
  }
}
