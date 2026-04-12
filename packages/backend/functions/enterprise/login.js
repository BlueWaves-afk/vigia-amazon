const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { ddb, QueryCommand, ok, err } = require('./_shared');

const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }, body: '' };

  const { email, password } = JSON.parse(event.body || '{}');
  if (!email || !password) return err(400, 'email and password required');

  try {
    const auth = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.USER_POOL_CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }));

    const { IdToken: idToken, AccessToken: accessToken } = auth.AuthenticationResult;

    // Decode sub from idToken (base64 middle segment)
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
    const userId = payload.sub;

    // Fetch user record
    const { Item: user } = await ddb.send(new QueryCommand({
      TableName: process.env.USERS_TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      Limit: 1,
    })).then(r => ({ Item: r.Items?.[0] }));

    if (!user) return err(404, 'User record not found');

    return ok({ idToken, accessToken, userId, email: user.email, apiKey: user.apiKey, trialVga: user.trialVga, dataCredits: user.dataCredits });
  } catch (e) {
    if (e.name === 'NotAuthorizedException') return err(401, 'Invalid email or password');
    if (e.name === 'UserNotFoundException') return err(401, 'Invalid email or password');
    console.error('[login]', e);
    return err(500, e.message || 'Login failed');
  }
};
