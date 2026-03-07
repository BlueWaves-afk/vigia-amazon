import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const RATE_LIMIT_HOUR_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 30;
const rateLimitStore = new Map<string, { requests: number[]; hourlyRequests: number[] }>();

function checkRateLimit(ip: string): { allowed: boolean; reason?: string; retryAfter?: number } {
  const now = Date.now();
  let entry = rateLimitStore.get(ip);
  if (!entry) {
    entry = { requests: [], hourlyRequests: [] };
    rateLimitStore.set(ip, entry);
  }
  entry.requests = entry.requests.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  entry.hourlyRequests = entry.hourlyRequests.filter(t => now - t < RATE_LIMIT_HOUR_MS);
  if (entry.requests.length >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, reason: `Rate limit: ${MAX_REQUESTS_PER_WINDOW} queries per minute`, retryAfter: RATE_LIMIT_WINDOW_MS - (now - Math.min(...entry.requests)) };
  }
  if (entry.hourlyRequests.length >= MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, reason: `Rate limit: ${MAX_REQUESTS_PER_HOUR} queries per hour`, retryAfter: RATE_LIMIT_HOUR_MS - (now - Math.min(...entry.hourlyRequests)) };
  }
  entry.requests.push(now);
  entry.hourlyRequests.push(now);
  return { allowed: true };
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: rateLimitCheck.reason, retryAfter: rateLimitCheck.retryAfter }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitCheck.retryAfter || 0) / 1000)) } });
    }

    const body = await req.json();
    const { geohash, radiusKm, query, context } = body;
    const activeGeohash = geohash ?? context?.geohash;

    if (!activeGeohash) {
      return NextResponse.json(
        { error: 'geohash required (provide body.geohash or context.geohash)' },
        { status: 400 }
      );
    }

    const agentId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ID;
    const agentAliasId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID;
    const region = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';

    if (!agentId || !agentAliasId) {
      return NextResponse.json(
        { error: 'Agent configuration missing' },
        { status: 503 }
      );
    }

    const client = new BedrockAgentRuntimeClient({ region });

    const inputText =
      query ||
      `Analyze the DePIN network health for geohash ${activeGeohash} within ${radiusKm || 10}km radius. Use the analyze_node_connectivity tool to get active node count, geographic spread, and health score. Also use identify_coverage_gaps to find areas with low sensor coverage.`;

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId: `network-analysis-${Date.now()}`,
      inputText,
      enableTrace: true,
    });

    const response = await client.send(command);

    let completion = '';
    const traces: any[] = [];

    if (response.completion) {
      for await (const event of response.completion) {
        if (event.chunk?.bytes) {
          completion += new TextDecoder().decode(event.chunk.bytes);
        }
        if (event.trace) {
          traces.push(event.trace);
        }
      }
    }

    return NextResponse.json({
      analysis: completion || 'No response from agent.',
      sessionId: response.sessionId,
      traces,
    });
  } catch (err: any) {
    console.error('[network-analysis] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Network analysis failed' },
      { status: 500 }
    );
  }
}
