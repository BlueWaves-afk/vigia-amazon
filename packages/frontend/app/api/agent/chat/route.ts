import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

// Increase API route timeout for complex agent queries
export const maxDuration = 60; // 60 seconds

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;
const RATE_LIMIT_HOUR_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 30;

// In-memory rate limit store (per IP)
const rateLimitStore = new Map<string, { requests: number[]; hourlyRequests: number[] }>();

function checkRateLimit(ip: string): { allowed: boolean; reason?: string; retryAfter?: number } {
  const now = Date.now();
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(ip);
  if (!entry) {
    entry = { requests: [], hourlyRequests: [] };
    rateLimitStore.set(ip, entry);
  }

  // Clean old requests (older than 1 minute)
  entry.requests = entry.requests.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  entry.hourlyRequests = entry.hourlyRequests.filter(t => now - t < RATE_LIMIT_HOUR_MS);

  // Check per-minute limit
  if (entry.requests.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestRequest = Math.min(...entry.requests);
    const retryAfter = RATE_LIMIT_WINDOW_MS - (now - oldestRequest);
    return {
      allowed: false,
      reason: `Rate limit: ${MAX_REQUESTS_PER_WINDOW} queries per minute`,
      retryAfter,
    };
  }

  // Check per-hour limit
  if (entry.hourlyRequests.length >= MAX_REQUESTS_PER_HOUR) {
    const oldestRequest = Math.min(...entry.hourlyRequests);
    const retryAfter = RATE_LIMIT_HOUR_MS - (now - oldestRequest);
    return {
      allowed: false,
      reason: `Rate limit: ${MAX_REQUESTS_PER_HOUR} queries per hour`,
      retryAfter,
    };
  }

  // Record this request
  entry.requests.push(now);
  entry.hourlyRequests.push(now);

  return { allowed: true };
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

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
    | 'timeout'
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
  } else if (/timeout/i.test(message) || name === 'TimeoutError') {
    errorType = 'timeout';
  }

  return { name, message, requestId, httpStatusCode, errorType };
}

export async function POST(req: NextRequest) {
  try {
    // Check rate limit
    const clientIp = getClientIp(req);
    const rateLimitCheck = checkRateLimit(clientIp);
    
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: rateLimitCheck.reason,
          retryAfter: rateLimitCheck.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitCheck.retryAfter || 0) / 1000)),
          },
        }
      );
    }

    const { query, sessionId, diffContext, context } = await req.json();

    const agentId =
      process.env.BEDROCK_AGENT_ID || process.env.NEXT_PUBLIC_BEDROCK_AGENT_ID;
    const agentAliasId =
      process.env.BEDROCK_AGENT_ALIAS_ID ||
      process.env.NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID;
    const region = getAwsRegion();

    if (!agentId || !agentAliasId) {
      return NextResponse.json(
        { error: 'Bedrock Agent not configured' },
        { status: 503 }
      );
    }

    // Build context-aware prompt
    let inputText = query;
    const contextParts: string[] = [];

    // Add pinned sessions context
    if (context?.pinnedSessions && context.pinnedSessions.length > 0) {
      contextParts.push(`Pinned sessions: ${context.pinnedSessions.join(', ')}`);
    }

    // Add map/session context if available
    if (context) {
      if (context.sessionId) {
        contextParts.push(`Current session: ${context.sessionId}`);
      }
      if (context.viewport) {
        const { north, south, east, west } = context.viewport;
        contextParts.push(`Map viewport: north=${north}, south=${south}, east=${east}, west=${west}`);
      }
      if (context.selectedHazards && context.selectedHazards.length > 0) {
        contextParts.push(`Selected hazards: ${context.selectedHazards.slice(0, 5).join(', ')}`);
      }
      if (context.geohash) {
        contextParts.push(`Current geohash: ${context.geohash}`);
      }
      
      // Add route context if available
      if (context.type === 'route-calculated' && context.fastest && context.safest) {
        contextParts.push(`Route calculated between (${context.pinA?.lat}, ${context.pinA?.lon}) and (${context.pinB?.lat}, ${context.pinB?.lon})`);
        contextParts.push(`Fastest route: ${context.fastest.distance_km}km, ${context.fastest.duration_minutes}min, ${context.fastest.hazards_count} hazards`);
        contextParts.push(`Safest route: ${context.safest.distance_km}km, ${context.safest.duration_minutes}min, ${context.safest.hazards_count} hazards, avoided ${context.safest.hazards_avoided} hazards`);
        contextParts.push(`Recommendation: ${context.recommendation}`);
      }
    }

    // Add diff context if comparing sessions
    if (diffContext) {
      contextParts.push(`Comparing sessions: ${diffContext.sessionA} vs ${diffContext.sessionB}`);
      contextParts.push(`Changes: ${diffContext.totalNew || 0} new, ${diffContext.totalFixed || 0} fixed`);
    }

    // Construct final prompt with context
    if (contextParts.length > 0) {
      inputText = `[Context]\n${contextParts.join('\n')}\n\n[Query]\n${query}`;
    }

    // Check if query is asking for global context
    const isGlobalQuery = /\b(all|global|entire|everywhere|total)\b/i.test(query);
    if (isGlobalQuery && !query.includes('geohash') && !query.includes('location')) {
      inputText += '\n\nNote: User is asking for global/all hazards across the entire system.';
    }

    const client = new BedrockAgentRuntimeClient({
      region,
      requestHandler: {
        requestTimeout: 60000,
      } as any,
    });

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId: sessionId ?? `chat-${Date.now()}`,
      inputText,
      enableTrace: true,
    });

    const response = await client.send(command);

    let completion = '';
    const traces: any[] = [];
    const thinkingSteps: string[] = [];

    if (response.completion) {
      for await (const event of response.completion) {
        if (event.chunk?.bytes) {
          completion += new TextDecoder().decode(event.chunk.bytes);
        }
        if (event.trace) {
          traces.push(event.trace);
          const rationale = event.trace.trace?.orchestrationTrace?.rationale?.text;
          if (rationale) thinkingSteps.push(rationale);
        }
      }
    }

    return NextResponse.json({
      content:
        completion ||
        'No response from agent. The agent may be processing your request. Try asking with more specific context.',
      sessionId: response.sessionId,
      traces,
      thinking: thinkingSteps,
    });
  } catch (err: any) {
    const awsError = normalizeAwsError(err);
    console.error('[agent/chat] Error', { ...awsError, region: getAwsRegion() });

    if (awsError.errorType === 'timeout') {
      return NextResponse.json(
        {
          content:
            "I'm currently experiencing high load. Try asking with specific context:\n\n• 'What hazards in geohash drt2yzr need attention?'\n• 'Analyze network health for current map area'\n• 'Find optimal path from (42.36, -71.06) to (42.37, -71.05)'\n\nOr ask about global data: 'Show all hazards globally'",
          sessionId: `error-${Date.now()}`,
        },
        { status: 200 }
      );
    }

    const debugDetails =
      process.env.DEBUG_API_ERRORS === 'true' || process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      {
        error: err?.message || 'Agent invocation failed',
        errorType: awsError.errorType,
        requestId: awsError.requestId,
        ...(debugDetails ? { details: awsError } : {}),
      },
      { status: 500 }
    );
  }
}

