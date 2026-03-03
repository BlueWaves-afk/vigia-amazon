import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { start, end, constraints } = body;

    if (!start || !end || !start.lat || !end.lat) {
      return NextResponse.json(
        { error: 'start and end coordinates required' },
        { status: 400 }
      );
    }

    const agentId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ID || 'TAWWC3SQ0L';
    const agentAliasId = process.env.NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID || 'TSTALIASID';
    const region = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';

    const client = new BedrockAgentRuntimeClient({ region });

    const avoidTypes = constraints?.avoidHazardTypes?.join(', ') || 'potholes';
    const inputText = `Find optimal path from latitude ${start.lat}, longitude ${start.lon} to latitude ${end.lat}, longitude ${end.lon}, avoiding ${avoidTypes}. Return the path waypoints, distance, hazards avoided, and ROI analysis.`;

    const command = new InvokeAgentCommand({
      agentId,
      agentAliasId,
      sessionId: `urban-planning-${Date.now()}`,
      inputText,
    });

    const response = await client.send(command);

    let agentResponse = '';
    if (response.completion) {
      for await (const event of response.completion) {
        if (event.chunk?.bytes) {
          agentResponse += new TextDecoder().decode(event.chunk.bytes);
        }
      }
    }

    // Parse agent response to extract structured data
    // The agent will return the path data from the Urban Planner Lambda
    let parsedData: any = {};
    
    try {
      // Try to extract JSON from agent response
      const jsonMatch = agentResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log('[urban-planning] Could not parse JSON from agent response');
    }

    // Convert path to GeoJSON format for frontend
    const proposedPath = parsedData.path ? {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: parsedData.path.map((p: any) => [p.lon, p.lat])
      },
      properties: {
        totalDistanceKm: parsedData.totalDistanceKm,
        hazardsAvoided: parsedData.hazardsAvoided,
        detourPercent: parsedData.detourPercent,
        constructionCost: parsedData.constructionCost,
        breakEvenYears: parsedData.breakEvenYears,
        roi10Year: parsedData.roi10Year,
        compliance: parsedData.compliance,
        zoneIntersections: parsedData.zoneIntersections,
        recommendation: parsedData.recommendation
      }
    } : null;

    return NextResponse.json({
      proposedPath,
      analysis: agentResponse,
      rawData: parsedData,
      sessionId: response.sessionId,
    });
  } catch (err: any) {
    console.error('[urban-planning] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Urban planning analysis failed' },
      { status: 500 }
    );
  }
}
