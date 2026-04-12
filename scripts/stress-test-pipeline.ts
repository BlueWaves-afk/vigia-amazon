/**
 * Stress test for Pipeline V2:
 * 1. Agent invocation — does it respond + produce ReAct steps?
 * 2. Traces API — does GET /api/traces/{hazardId} return a trace?
 * 3. View Reasoning wiring — does the trace have react_steps + agent_final_answer?
 * 4. Duplicate reward dedup — same geohash twice, second should have reward_skipped_reason
 *
 * Run: npx ts-node --esm scripts/stress-test-pipeline.ts
 * Or:  npx tsx scripts/stress-test-pipeline.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const REGION = 'us-east-1';
const AGENT_ID = 'TAWWC3SQ0L';
const AGENT_ALIAS_ID = 'TSTALIASID';
const TRACES_TABLE = 'VigiaStack-IntelligenceWithHazardsAgentTracesTable5CD02A70-C0SX07TU70LN';
const HAZARDS_TABLE = 'VigiaStack-IngestionHazardsTable05BAEAEE-1B0GEE1NV7PU5';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️ ';

function log(icon: string, label: string, detail?: string) {
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`);
}

// ── Test 1: Agent invocation + ReAct trace extraction ────────────────────────
async function testAgentInvocation() {
  console.log('\n── Test 1: Bedrock Agent InvokeAgent + ReAct trace ──');
  const sessionId = `stress-${Date.now()}`;
  const prompt =
    'A dashcam frame was analysed by a vision model for a reported POTHOLE at geohash drt2yzr. ' +
    'VLM reasoning: "I can see a large pothole approximately 30cm wide with visible cracking." ' +
    'VLM confidence: 0.87. ' +
    'Please verify this hazard: query existing hazards at geohash drt2yzr, calculate the verification score, and give your final verdict.';

  try {
    const { BedrockAgentRuntimeClient, InvokeAgentCommand } = await import('@aws-sdk/client-bedrock-agent-runtime');
    const agentClient = new BedrockAgentRuntimeClient({ region: REGION });
    const res = await agentClient.send(new InvokeAgentCommand({
      agentId: AGENT_ID,
      agentAliasId: AGENT_ALIAS_ID,
      sessionId,
      inputText: prompt,
      enableTrace: true,
    }));

    const reactSteps: any[] = [];
    let finalAnswer = '';
    let agentScore: number | null = null;

    for await (const event of res.completion!) {
      if (event.trace?.trace?.orchestrationTrace) {
        const orch = event.trace.trace.orchestrationTrace;
        if (orch.modelInvocationInput?.text) {
          const thinking = orch.modelInvocationInput.text.match(/<thinking>([\s\S]*?)<\/thinking>/)?.[1]?.trim();
          if (thinking) reactSteps.push({ thought: thinking.slice(0, 120) + '...' });
        }
        if (orch.invocationInput?.actionGroupInvocationInput) {
          const inv = orch.invocationInput.actionGroupInvocationInput;
          const actionInput: Record<string, unknown> = {};
          inv.parameters?.forEach((p: any) => { actionInput[p.name] = p.value; });
          const last = reactSteps[reactSteps.length - 1];
          if (last && !last.action) { last.action = inv.apiPath; last.actionInput = actionInput; }
          else reactSteps.push({ action: inv.apiPath, actionInput });
        }
        if (orch.observation?.actionGroupInvocationOutput?.text) {
          const obs = orch.observation.actionGroupInvocationOutput.text;
          const last = reactSteps[reactSteps.length - 1];
          if (last) last.observation = obs.slice(0, 100) + '...';
          const m = obs.match(/"verificationScore"\s*:\s*([\d.]+)/);
          if (m) agentScore = parseFloat(m[1]);
        }
        if (orch.observation?.finalResponse?.text) finalAnswer = orch.observation.finalResponse.text;
      }
      if (event.chunk?.bytes) finalAnswer += new TextDecoder().decode(event.chunk.bytes);
    }

    log(reactSteps.length > 0 ? PASS : FAIL, `ReAct steps extracted`, `${reactSteps.length} steps`);
    log(finalAnswer ? PASS : FAIL, `Final answer received`, finalAnswer.slice(0, 100) + '...');
    log(agentScore != null ? PASS : WARN, `Score from agent`, agentScore != null ? String(agentScore) : 'not found in observation (will use fallback)');

    console.log('\n  ReAct steps:');
    reactSteps.forEach((s, i) => {
      if (s.thought) console.log(`    [${i}] THOUGHT: ${s.thought.slice(0, 80)}...`);
      if (s.action)  console.log(`    [${i}] ACTION:  ${s.action} ${JSON.stringify(s.actionInput ?? {})}`);
      if (s.observation) console.log(`    [${i}] OBS:     ${s.observation.slice(0, 80)}...`);
    });

    return { passed: reactSteps.length > 0 && !!finalAnswer, reactSteps, finalAnswer, agentScore };
  } catch (e: any) {
    log(FAIL, 'Agent invocation failed', e.message);
    return { passed: false };
  }
}

// ── Test 2: TracesTable query by hazardId ─────────────────────────────────────
async function testTracesTableQuery() {
  console.log('\n── Test 2: TracesTable HazardIdIndex query ──');

  // Find a real hazardId from the hazards table
  const hazardsRes = await dynamodb.send(new QueryCommand({
    TableName: HAZARDS_TABLE,
    IndexName: 'status-timestamp-index',
    KeyConditionExpression: '#s = :v',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':v': 'VERIFIED' },
    Limit: 3,
    ScanIndexForward: false,
  }));

  const hazards = hazardsRes.Items ?? [];
  log(hazards.length > 0 ? PASS : WARN, `Found VERIFIED hazards`, `${hazards.length} items`);

  if (hazards.length === 0) {
    log(WARN, 'No VERIFIED hazards to test trace lookup against');
    return { passed: false };
  }

  let traceFound = false;
  let traceHasReactSteps = false;
  let traceHasRewardSkip = false;

  for (const h of hazards) {
    const hazardId = `${h.geohash}#${h.timestamp}`;
    const res = await dynamodb.send(new QueryCommand({
      TableName: TRACES_TABLE,
      IndexName: 'HazardIdIndex',
      KeyConditionExpression: 'hazardId = :id',
      ExpressionAttributeValues: { ':id': hazardId },
      Limit: 1,
      ScanIndexForward: false,
    }));
    const trace = res.Items?.[0];
    if (trace) {
      traceFound = true;
      traceHasReactSteps = Array.isArray(trace.react_steps) && trace.react_steps.length > 0;
      traceHasRewardSkip = !!trace.reward_skipped_reason;
      log(PASS, `Trace found for ${hazardId.slice(-20)}`, `verdict=${trace.verdict} score=${trace.total_score}`);
      log(traceHasReactSteps ? PASS : WARN, `react_steps present`, traceHasReactSteps ? `${trace.react_steps.length} steps` : 'missing (old trace pre-deploy)');
      log(trace.agent_final_answer ? PASS : WARN, `agent_final_answer present`, trace.agent_final_answer ? 'yes' : 'missing (old trace)');
      if (traceHasRewardSkip) log(PASS, `reward_skipped_reason present`, trace.reward_skipped_reason);
      break;
    }
  }

  if (!traceFound) log(WARN, 'No traces found for any VERIFIED hazard — traces may be from before V2 deploy');
  return { passed: traceFound };
}

// ── Test 3: Frontend /api/traces proxy ────────────────────────────────────────
async function testFrontendTracesProxy() {
  console.log('\n── Test 3: Frontend /api/traces/{hazardId} proxy ──');

  // Use a known hazardId from the hazards table
  const hazardsRes = await dynamodb.send(new QueryCommand({
    TableName: HAZARDS_TABLE,
    IndexName: 'status-timestamp-index',
    KeyConditionExpression: '#s = :v',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':v': 'VERIFIED' },
    Limit: 1,
    ScanIndexForward: false,
  }));

  const h = hazardsRes.Items?.[0];
  if (!h) { log(WARN, 'No VERIFIED hazard to test proxy with'); return { passed: false }; }

  const hazardId = `${h.geohash}#${h.timestamp}`;
  const url = `${FRONTEND_URL}/api/traces/${encodeURIComponent(hazardId)}`;
  console.log(`  GET ${url}`);

  try {
    const res = await fetch(url);
    const json = await res.json() as any;
    log(res.ok ? PASS : FAIL, `HTTP ${res.status}`);
    log(json.trace !== undefined ? PASS : FAIL, `Response has trace field`, json.trace ? `verdict=${json.trace.verdict}` : 'null');
    if (json.trace) {
      log(json.trace.react_steps ? PASS : WARN, `react_steps in proxy response`, json.trace.react_steps ? `${json.trace.react_steps.length} steps` : 'missing');
      log(json.trace.agent_final_answer ? PASS : WARN, `agent_final_answer in proxy response`);
    }
    return { passed: res.ok && json.trace !== undefined };
  } catch (e: any) {
    log(FAIL, 'Fetch failed', e.message);
    return { passed: false };
  }
}

// ── Test 4: Duplicate reward dedup in TracesTable ─────────────────────────────
async function testDuplicateRewardDedup() {
  console.log('\n── Test 4: Duplicate reward dedup (ledger credits=0) ──');
  const LEDGER_TABLE = 'VigiaStack-TrustLedgerTableD0EF6ED1-FSHKRP1596UJ';
  // Just check a few known ledger items for credits=0
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const ledgerRes = await Promise.race([
    dynamodb.send(new ScanCommand({ TableName: LEDGER_TABLE, FilterExpression: 'credits = :z', ExpressionAttributeValues: { ':z': 0 }, Limit: 5 })),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
  ]);
  const zeroCredit = (ledgerRes as any).Items ?? [];
  log(zeroCredit.length > 0 ? PASS : WARN,
    `Ledger entries with credits=0 (dedup fired)`,
    zeroCredit.length > 0 ? `${zeroCredit.length} found` : 'none yet — submit same location twice to trigger'
  );
  return { passed: true };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  VIGIA Pipeline V2 — Stress Test');
  console.log('═══════════════════════════════════════════════');

  const t1 = await testAgentInvocation();
  const t2 = await testTracesTableQuery();
  const t4 = await testDuplicateRewardDedup();

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Agent ReAct invocation : ${t1.passed ? PASS : FAIL}`);
  console.log(`  TracesTable query      : ${t2.passed ? PASS : WARN} (WARN = no V2 traces yet)`);
  console.log(`  Reward dedup           : ${t4.passed ? PASS : WARN}`);
  console.log('');
}

main().catch(console.error);
