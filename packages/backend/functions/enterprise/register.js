const { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { ddb, PutCommand, ok, err, genApiKey } = require('./_shared');

const cognito = new CognitoIdentityProviderClient({});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }, body: '' };

  const { email, password } = JSON.parse(event.body || '{}');
  if (!email || !password) return err(400, 'email and password required');
  if (password.length < 8) return err(400, 'password must be at least 8 characters');

  try {
    // Sign up in Cognito
    const signUp = await cognito.send(new SignUpCommand({
      ClientId: process.env.USER_POOL_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }],
    }));

    const userId = signUp.UserSub;

    // Auto-confirm for trial (no email verification step)
    await cognito.send(new AdminConfirmSignUpCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: email,
    }));

    const apiKey = genApiKey();

    // Create user record in DynamoDB
    await ddb.send(new PutCommand({
      TableName: process.env.USERS_TABLE,
      Item: {
        userId,
        email,
        apiKey,
        trialVga: 20,
        dataCredits: 0,
        createdAt: new Date().toISOString(),
      },
      ConditionExpression: 'attribute_not_exists(userId)',
    }));

    return ok({ userId, email, apiKey, trialVga: 20, dataCredits: 0 });
  } catch (e) {
    if (e.name === 'UsernameExistsException') return err(409, 'An account with this email already exists');
    console.error('[register]', e);
    return err(500, e.message || 'Registration failed');
  }
};
