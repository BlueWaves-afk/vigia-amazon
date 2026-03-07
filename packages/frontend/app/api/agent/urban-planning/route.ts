import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

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
    const { start, end, constraints } = body;

    if (!start || !end || !start.lat || !end.lat) {
      return NextResponse.json(
        { error: 'start and end coordinates required' },
        { status: 400 }
      );
    }

    const region = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';
    const lambdaClient = new LambdaClient({ region });

    // Call Lambda directly for pin routing
    const payload = {
      messageVersion: '1.0',
      agent: {
        name: 'vigia-auditor-strategist',
        id: 'TAWWC3SQ0L',
        alias: 'TSTALIASID',
        version: 'DRAFT'
      },
      actionGroup: 'UrbanPlanner',
      apiPath: '/calculate-pin-routes',
      httpMethod: 'POST',
      parameters: [
        { name: 'start_lat', type: 'number', value: String(start.lat) },
        { name: 'start_lon', type: 'number', value: String(start.lon) },
        { name: 'end_lat', type: 'number', value: String(end.lat) },
        { name: 'end_lon', type: 'number', value: String(end.lon) }
      ]
    };

    const command = new InvokeCommand({
      FunctionName: 'VigiaStack-IntelligenceWithHazardsUrbanPlannerFunc-spESG0Jxisgr',
      Payload: JSON.stringify(payload),
    });

    const response = await lambdaClient.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    
    // Extract the body from Lambda response
    if (result.response?.responseBody?.['application/json']?.body) {
      const body = JSON.parse(result.response.responseBody['application/json'].body);
      
      // Format response for agent display
      const message = `Route calculation complete:\n\n**Fastest Route:**\n- Distance: ${body.fastest.distance_km} km\n- Duration: ${body.fastest.duration_minutes} min\n- Hazards: ${body.fastest.hazards_count}\n\n**Safest Route:**\n- Distance: ${body.safest.distance_km} km\n- Duration: ${body.safest.duration_minutes} min\n- Hazards: ${body.safest.hazards_count}\n- Avoided: ${body.safest.hazards_avoided} hazards\n- Detour: ${body.safest.detour_percent}%\n\n**Recommendation:** ${body.recommendation}`;
      
      return NextResponse.json({ 
        message,
        pathData: body,
        analysis: message
      });
    }

    return NextResponse.json({ error: 'Invalid Lambda response', raw: result }, { status: 500 });
  } catch (error) {
    console.error('Urban planning error:', error);
    return NextResponse.json({ error: 'Failed to calculate route' }, { status: 500 });
  }
}
