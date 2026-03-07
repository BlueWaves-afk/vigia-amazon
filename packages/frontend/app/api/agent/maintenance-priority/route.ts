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
    const { hazardIds, hazards } = body;

    if (!hazardIds || hazardIds.length === 0) {
      return NextResponse.json(
        { error: 'hazardIds required' },
        { status: 400 }
      );
    }

    const region = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';
    const lambdaClient = new LambdaClient({ region });

    // Call Lambda directly for maintenance prioritization
    const payload = {
      messageVersion: '1.0',
      agent: {
        name: 'vigia-auditor-strategist',
        id: 'TAWWC3SQ0L',
        alias: 'TSTALIASID',
        version: 'DRAFT'
      },
      actionGroup: 'MaintenanceLogistics',
      apiPath: '/prioritize-repair-queue',
      httpMethod: 'POST',
      parameters: [
        { name: 'hazardIds', type: 'array', value: JSON.stringify(hazardIds) }
      ]
    };

    const command = new InvokeCommand({
      FunctionName: 'VigiaStack-IntelligenceWithHazardsMaintenanceLogis-DFZlsGUW5tBE',
      Payload: JSON.stringify(payload),
    });

    const response = await lambdaClient.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    
    // Extract the body from Lambda response
    if (result.response?.responseBody?.['application/json']?.body) {
      const body = JSON.parse(result.response.responseBody['application/json'].body);
      
      // Format response for agent display
      const queue = body.prioritizedQueue || [];
      const message = `Maintenance Priority Analysis:\n\n${queue.map((item: any, i: number) => 
        `**${i + 1}. ${item.hazardType}** (Priority: ${item.priority.toFixed(1)}/100)\n` +
        `   - Location: (${item.lat?.toFixed(4)}, ${item.lon?.toFixed(4)})\n` +
        `   - Estimated Cost: $${item.estimatedCost}\n` +
        `   - Reasoning: ${item.reasoning}`
      ).join('\n\n')}`;
      
      return NextResponse.json({ 
        message,
        prioritizedQueue: queue,
        analysis: message
      });
    }

    return NextResponse.json({ error: 'Invalid Lambda response', raw: result }, { status: 500 });
  } catch (error) {
    console.error('Maintenance priority error:', error);
    return NextResponse.json({ error: 'Failed to prioritize maintenance' }, { status: 500 });
  }
}
