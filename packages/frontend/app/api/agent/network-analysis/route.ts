import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
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
