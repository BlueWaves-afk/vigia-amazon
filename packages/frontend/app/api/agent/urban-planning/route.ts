import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { enforceAgentRateLimit } from '@/app/lib/server/agent-rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceAgentRateLimit(req);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: rl.reason, retryAfter: rl.retryAfterMs },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 0) / 1000)) },
        }
      );
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
