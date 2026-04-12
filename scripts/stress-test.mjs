import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const REGION       = 'us-east-1';
const AGENT_ID     = 'TAWWC3SQ0L';
const ALIAS_ID     = 'TSTALIASID';
const TRACES_TABLE = 'VigiaStack-IntelligenceWithHazardsAgentTracesTable5CD02A70-C0SX07TU70LN';
const HAZARDS_TABLE= 'VigiaStack-IngestionHazardsTable05BAEAEE-1B0GEE1NV7PU5';
const LEDGER_TABLE = 'VigiaStack-TrustLedgerTableD0EF6ED1-FSHKRP1596UJ';

const agent   = new BedrockAgentRuntimeClient({ region: REGION });
const dynamo  = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const P = '✅', F = '❌', W = '⚠️ ';

// ── Test 1: Agent ReAct ───────────────────────────────────────────────────────
console.log('\n── Test 1: Bedrock Agent InvokeAgent + ReAct trace ──');
try {
  const res = await agent.send(new InvokeAgentCommand({
    agentId: AGENT_ID, agentAliasId: ALIAS_ID,
    sessionId: 'stress-' + Date.now(),
    inputText: 'A dashcam frame shows a POTHOLE at geohash drt2yzr. VLM confidence: 0.87. Query hazards at drt2yzr, calculate verification score, give final verdict.',
    enableTrace: true,
  }));
  let steps = 0, answer = '';
  for await (const e of res.completion) {
    if (e.trace?.trace?.orchestrationTrace) steps++;
    if (e.chunk?.bytes) answer += new TextDecoder().decode(e.chunk.bytes);
  }
  console.log(steps > 0 ? P : F, `ReAct steps: ${steps}`);
  console.log(answer   ? P : F, `Final answer: ${answer.slice(0, 120)}`);
} catch(e) {
  console.log(F, 'Agent failed:', e.message);
}

// ── Test 2: TracesTable query ─────────────────────────────────────────────────
console.log('\n── Test 2: TracesTable HazardIdIndex query ──');
const hazardsRes = await dynamo.send(new QueryCommand({
  TableName: HAZARDS_TABLE,
  IndexName: 'status-timestamp-index',
  KeyConditionExpression: '#s = :v',
  ExpressionAttributeNames: { '#s': 'status' },
  ExpressionAttributeValues: { ':v': 'VERIFIED' },
  Limit: 3, ScanIndexForward: false,
}));
const hazards = hazardsRes.Items ?? [];
console.log(hazards.length > 0 ? P : W, `VERIFIED hazards found: ${hazards.length}`);

for (const h of hazards) {
  const hazardId = `${h.geohash}#${h.timestamp}`;
  const tr = await dynamo.send(new QueryCommand({
    TableName: TRACES_TABLE, IndexName: 'HazardIdIndex',
    KeyConditionExpression: 'hazardId = :id',
    ExpressionAttributeValues: { ':id': hazardId },
    Limit: 1, ScanIndexForward: false,
  }));
  const trace = tr.Items?.[0];
  if (trace) {
    console.log(P, `Trace found: verdict=${trace.verdict} score=${trace.total_score}`);
    console.log(Array.isArray(trace.react_steps) && trace.react_steps.length > 0 ? P : W,
      `react_steps: ${Array.isArray(trace.react_steps) ? trace.react_steps.length + ' steps' : 'missing (pre-V2 trace)'}`);
    console.log(trace.agent_final_answer ? P : W,
      `agent_final_answer: ${trace.agent_final_answer ? 'present' : 'missing (pre-V2 trace)'}`);
    console.log(trace.reward_skipped_reason ? P : W,
      `reward_skipped_reason: ${trace.reward_skipped_reason ?? 'none'}`);
    break;
  }
}

// ── Test 3: Reward dedup (ledger credits=0) ───────────────────────────────────
console.log('\n── Test 3: Reward dedup ──');
try {
  const scan = await Promise.race([
    dynamo.send(new ScanCommand({ TableName: LEDGER_TABLE, FilterExpression: 'credits = :z', ExpressionAttributeValues: { ':z': 0 }, Limit: 5 })),
    new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
  ]);
  const dupes = scan.Items ?? [];
  console.log(dupes.length > 0 ? P : W, `credits=0 ledger entries: ${dupes.length > 0 ? dupes.length : 'none yet — submit same location twice'}`);
} catch(e) {
  console.log(W, 'Dedup scan:', e.message);
}

console.log('\n── Done ──');
