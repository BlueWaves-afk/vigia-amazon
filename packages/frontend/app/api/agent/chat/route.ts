import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

// Increase API route timeout for complex agent queries
export const maxDuration = 60; // 60 seconds

export async function POST(req: NextRequest) {
  try {
    const { query, sessionId, diffContext, context } = await req.json();

    const agentId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ID;
    const agentAliasId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID;
    const region = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';

    if (!agentId || !agentAliasId) {
      return NextResponse.json(
        { error: 'Bedrock Agent not configured' },
        { status: 503 }
      );
    }

    const client = new BedrockAgentRuntimeClient({ 
      region,
      requestHandler: {
        requestTimeout: 60000, // Increase to 60 seconds for complex queries
      } as any
    });

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

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId: sessionId ?? `chat-${Date.now()}`,
      inputText,
      enableTrace: true, // Enable trace events
    });

    const response = await client.send(command);

    let completion = '';
    const traces: any[] = [];
    let eventCount = 0;
    
    if (response.completion) {
      for await (const event of response.completion) {
        eventCount++;
        console.log(`[agent/chat] Event ${eventCount}:`, JSON.stringify(event, null, 2));
        
        if (event.chunk?.bytes) {
          const chunk = new TextDecoder().decode(event.chunk.bytes);
          console.log(`[agent/chat] Chunk received: ${chunk.substring(0, 100)}...`);
          completion += chunk;
        }
        // Capture trace events
        if (event.trace) {
          traces.push(event.trace);
        }
      }
    }

    console.log(`[agent/chat] Total events: ${eventCount}, Completion length: ${completion.length}`);

    return NextResponse.json({
      content: completion || 'No response from agent. The agent may be processing your request. Try asking with more specific context.',
      sessionId: response.sessionId,
      traces, // Include traces in response
    });
  } catch (err: any) {
    console.error('[agent/chat] Error:', err);
    
    if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
      return NextResponse.json(
        { 
          content: "I'm currently experiencing high load. Try asking with specific context:\n\n• 'What hazards in geohash drt2yzr need attention?'\n• 'Analyze network health for current map area'\n• 'Find optimal path from (42.36, -71.06) to (42.37, -71.05)'\n\nOr ask about global data: 'Show all hazards globally'",
          sessionId: `error-${Date.now()}`
        },
        { status: 200 }
      );
    }
    
    return NextResponse.json(
      { error: err.message || 'Agent invocation failed' },
      { status: 500 }
    );
  }
}

