const { ddb, GetCommand, ok, err } = require('./_shared');

// Decode sub from JWT without verifying (API Gateway passes raw token; Cognito already validated it)
const getUserId = (event) => {
  try {
    const token = (event.headers?.Authorization || event.headers?.authorization || '').replace('Bearer ', '');
    if (!token) return null;
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub;
  } catch { return null; }
};

exports.handler = async (event) => {
  const userId = getUserId(event);
  if (!userId) return err(401, 'Unauthorized');

  const { Item: user } = await ddb.send(new GetCommand({
    TableName: process.env.USERS_TABLE,
    Key: { userId },
  }));

  if (!user) return err(404, 'User not found');

  return ok({ userId, email: user.email, apiKey: user.apiKey, trialVga: user.trialVga, dataCredits: user.dataCredits });
};
