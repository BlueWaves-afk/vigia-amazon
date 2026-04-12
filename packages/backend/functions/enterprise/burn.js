const { ddb, GetCommand, UpdateCommand, PutCommand, ok, err } = require('./_shared');

const getUserId = (event) => {
  try {
    const token = (event.headers?.Authorization || event.headers?.authorization || '').replace('Bearer ', '');
    if (!token) return null;
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub;
  } catch { return null; }
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }, body: '' };

  const userId = getUserId(event);
  if (!userId) return err(401, 'Unauthorized');

  const { vgaAmount } = JSON.parse(event.body || '{}');
  const amount = parseInt(vgaAmount, 10);
  if (!amount || amount < 1) return err(400, 'vgaAmount must be >= 1');

  // Fetch current user state
  const { Item: user } = await ddb.send(new GetCommand({
    TableName: process.env.USERS_TABLE,
    Key: { userId },
  }));
  if (!user) return err(404, 'User not found');

  // Server-side trial limit enforcement
  if (amount > user.trialVga) {
    return err(400, `Insufficient trial VGA. You have ${user.trialVga} VGA remaining. Trial accounts are limited to 20 VGA. Please contact sales to upgrade your SLA.`);
  }

  const creditsProvisioned = amount * 1000;
  const nodeRewardPool = Math.floor(amount * 0.20 * 100) / 100; // 20% to nodes
  const timestamp = new Date().toISOString();
  const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  // Atomic deduct + credit
  await ddb.send(new UpdateCommand({
    TableName: process.env.USERS_TABLE,
    Key: { userId },
    UpdateExpression: 'SET trialVga = trialVga - :amt, dataCredits = dataCredits + :credits',
    ConditionExpression: 'trialVga >= :amt',
    ExpressionAttributeValues: { ':amt': amount, ':credits': creditsProvisioned },
  }));

  // Write burn record (triggers rewards-distributor via stream)
  await ddb.send(new PutCommand({
    TableName: process.env.BURN_HISTORY_TABLE,
    Item: { userId, timestamp, vgaBurned: amount, creditsProvisioned, txHash, nodeRewardPool },
  }));

  return ok({
    trialVga: user.trialVga - amount,
    dataCredits: user.dataCredits + creditsProvisioned,
    creditsProvisioned,
    txHash,
    timestamp,
  });
};
