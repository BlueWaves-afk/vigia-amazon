const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const CONTRACT = '0x8c45482788De4a5d496089AD057E8CE550971b62';
const RPC = 'https://rpc-amoy.polygon.technology/';
const INITIAL_SUPPLY = 1_000_000; // VGA minted at genesis
// Tokenomics constants (BME architecture)
const NODE_REWARD_BPS = 0.20;     // 20% of each burn goes to node reward pool
const PRICE_GENESIS   = 1.00;     // P0: price at full supply (genesis price in USD)
const CREDITS_PER_VGA = 1000;     // 1 VGA = 1,000 API credits

/**
 * Bonding curve: P = P0 * (S0 / S)
 * As supply S decreases (burns), price P increases proportionally.
 * This is the simplest deflationary bonding curve used in DePIN tokenomics.
 * At S = S0 (no burns): P = P0 = $1.00
 * At S = S0/2 (50% burned): P = $2.00
 */
function bondingCurvePrice(currentSupply) {
  return PRICE_GENESIS * (INITIAL_SUPPLY / currentSupply);
}

async function ethCall(data) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: CONTRACT, data }, 'latest'] }),
  });
  const json = await res.json();
  return json.result;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  try {
    // 1. Real on-chain totalSupply
    const supplyHex = await ethCall('0x18160ddd');
    const totalSupplyVga = parseInt(supplyHex, 16) / 1e18;
    const totalBurnedVga = INITIAL_SUPPLY - totalSupplyVga;

    // Bonding curve price derived from real on-chain supply
    const vgaPriceUsd = bondingCurvePrice(totalSupplyVga);
    // Price impact of one more VGA burned (for UI preview)
    const priceAfterOneBurn = bondingCurvePrice(totalSupplyVga - 1);
    const priceImpactPerVga = priceAfterOneBurn - vgaPriceUsd;

    // 2. Real burn history from DynamoDB
    const { Items: burnRecords = [] } = await ddb.send(new ScanCommand({
      TableName: process.env.BURN_HISTORY_TABLE,
    }));
    const dbBurnedVga = burnRecords.reduce((s, r) => s + Number(r.vgaBurned || 0), 0);
    const nodeRewardPoolVga = burnRecords.reduce((s, r) => s + Number(r.nodeRewardPool || 0), 0);
    // Reward pool USD value uses current bonding curve price
    const nodeRewardPoolUsd = (nodeRewardPoolVga * vgaPriceUsd).toFixed(2);

    // 3. Real verified hazard contributions from HazardsTable
    const { Items: verifiedHazards = [] } = await ddb.send(new ScanCommand({
      TableName: process.env.HAZARDS_TABLE,
      FilterExpression: '#s = :v',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':v': 'verified' },
      ProjectionExpression: 'contributorId, confidence',
    }));

    // Tally contributions per node
    const nodeTally = {};
    for (const h of verifiedHazards) {
      const node = h.contributorId || 'unknown';
      nodeTally[node] = (nodeTally[node] || 0) + 1;
    }
    const totalContributions = verifiedHazards.length;

    // Node reward shares (USD at current bonding curve price)
    const nodeRewards = Object.entries(nodeTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nodeId, count]) => ({
        nodeId,
        contributions: count,
        sharePct: totalContributions > 0 ? (count / totalContributions * 100).toFixed(1) : '0',
        pendingRewardVga: totalContributions > 0
          ? (count / totalContributions * nodeRewardPoolVga).toFixed(4)
          : '0',
        pendingRewardUsd: totalContributions > 0
          ? (count / totalContributions * nodeRewardPoolVga * vgaPriceUsd).toFixed(2)
          : '0',
      }));

    // 4. Enterprise user stats
    const { Items: users = [] } = await ddb.send(new ScanCommand({
      TableName: process.env.USERS_TABLE,
      ProjectionExpression: 'trialVga, dataCredits',
    }));
    const totalDataCreditsProvisioned = users.reduce((s, u) => s + Number(u.dataCredits || 0), 0);
    const activeNodes = Object.keys(nodeTally).length;

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // On-chain (real)
        totalSupplyVga,
        totalBurnedVga,
        dbBurnedVga,
        supplyRemainingPct: (totalSupplyVga / INITIAL_SUPPLY * 100).toFixed(4),

        // Bonding curve price (real math, testnet supply)
        vgaPriceUsd,
        priceImpactPerVga,
        priceGenesisUsd: PRICE_GENESIS,
        bondingCurveFormula: 'P = P0 * (S0 / S)',

        // Reward pool (real, from DB, valued at current price)
        nodeRewardPoolVga,
        nodeRewardPoolUsd,
        nodeRewards,
        totalContributions,
        activeNodes,

        // API economy
        totalDataCreditsProvisioned,
        totalEnterpriseUsers: users.length,

        // Tokenomics constants (for UI display)
        tokenomics: {
          vgaToUsd: vgaPriceUsd,          // live bonding curve price
          creditsPerVga: CREDITS_PER_VGA,
          nodeRewardBps: NODE_REWARD_BPS,
          initialSupply: INITIAL_SUPPLY,
          trialVgaPerAccount: 20,
          trialUsdValue: 20 * vgaPriceUsd, // live USD value of trial wallet
        },
      }),
    };
  } catch (e) {
    console.error('[stats]', e);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
