const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Triggered by BurnHistoryTable DynamoDB Stream
exports.handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') continue;

    const burn = record.dynamodb.NewImage;
    const nodeRewardPool = Number(burn.nodeRewardPool?.N ?? 0);
    if (nodeRewardPool <= 0) continue;

    // Scan hazards for verified contributions in last 24h
    const since = new Date(Date.now() - 86400000).toISOString();
    const { Items: hazards = [] } = await ddb.send(new ScanCommand({
      TableName: process.env.HAZARDS_TABLE,
      FilterExpression: '#s = :v AND #ts >= :since',
      ExpressionAttributeNames: { '#s': 'status', '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':v': 'verified', ':since': since },
      Limit: 500,
    }));

    if (hazards.length === 0) {
      console.log('[rewards] No verified hazards in last 24h, pool carried forward');
      continue;
    }

    // Tally contributions per node
    const tally = {};
    for (const h of hazards) {
      const node = h.contributorId || h.geohash; // fallback to geohash if no contributorId
      tally[node] = (tally[node] || 0) + 1;
    }
    const total = Object.values(tally).reduce((a, b) => a + b, 0);

    // Log proportional rewards (in production: sign KMS payload per node)
    for (const [node, count] of Object.entries(tally)) {
      const share = (count / total) * nodeRewardPool;
      console.log(`[rewards] Node ${node}: ${count}/${total} contributions → ${share.toFixed(4)} VGA reward`);
      // TODO Phase 2: call KMS to sign claimRewards(nodeAddress, share, nonce)
    }
  }
};
