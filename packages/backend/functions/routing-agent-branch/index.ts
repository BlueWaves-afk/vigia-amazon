import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHash } from 'crypto';

// Simple in-memory cache for branch routing results
const cache = new Map<string, any>();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { branchId, hazards } = body;

    if (!branchId || !hazards) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing branchId or hazards' }),
      };
    }

    // Generate cache key from hazard array
    const cacheKey = createHash('sha256').update(JSON.stringify(hazards)).digest('hex');

    // Check cache
    if (cache.has(cacheKey)) {
      console.log('[RoutingAgentBranch] Cache hit:', cacheKey);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cache.get(cacheKey)),
      };
    }

    // Simulate routing computation (replace with actual Bedrock Agent call)
    const baselineAvgLatency = 12.5; // seconds
    const hazardCount = hazards.length;
    const branchAvgLatency = baselineAvgLatency * (1 + hazardCount * 0.05); // 5% increase per hazard
    const affectedRoutes = Math.min(hazardCount * 3, 50);

    const result = {
      baselineAvgLatency,
      branchAvgLatency: Number(branchAvgLatency.toFixed(2)),
      delta: Number((branchAvgLatency - baselineAvgLatency).toFixed(2)),
      deltaPercent: Number(((branchAvgLatency - baselineAvgLatency) / baselineAvgLatency * 100).toFixed(1)),
      affectedRoutes,
      computedAt: Date.now(),
    };

    // Cache result
    cache.set(cacheKey, result);

    // TODO: Replace with actual Bedrock Agent invocation
    // const bedrockResponse = await bedrockAgent.invokeAgent({
    //   agentId: process.env.ROUTING_AGENT_ID,
    //   sessionId: branchId,
    //   inputText: `Recompute routes avoiding these hazards: ${JSON.stringify(hazards)}`,
    //   enableTrace: false,
    // });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[RoutingAgentBranch] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
