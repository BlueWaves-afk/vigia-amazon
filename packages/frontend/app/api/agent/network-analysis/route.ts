import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { geohash, radiusKm, query, context } = body;

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

    // Use custom query if provided, otherwise use default
    const inputText = query || `Analyze the DePIN network health for geohash ${geohash} within ${radiusKm || 10}km radius. Use the analyze_node_connectivity tool to get active node count, geographic spread, and health score. Also use identify_coverage_gaps to find areas with low sensor coverage.`;

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
