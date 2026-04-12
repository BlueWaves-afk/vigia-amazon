import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class EnterpriseStack extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly userPool: cognito.UserPool;
  public readonly usersTable: dynamodb.Table;
  public readonly burnHistoryTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: { hazardsTable: dynamodb.Table }) {
    super(scope, id);

    // ── Cognito User Pool ──────────────────────────────────────────────────────
    this.userPool = new cognito.UserPool(this, 'EnterpriseUserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: { minLength: 8, requireDigits: true, requireLowercase: true, requireUppercase: false, requireSymbols: false },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'EnterpriseUserPoolClient', {
      userPool: this.userPool,
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
    });

    // ── DynamoDB Tables ────────────────────────────────────────────────────────
    this.usersTable = new dynamodb.Table(this, 'EnterpriseUsersTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // GSI for apiKey lookup
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'apiKey-index',
      partitionKey: { name: 'apiKey', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.burnHistoryTable = new dynamodb.Table(this, 'BurnHistoryTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Shared env ─────────────────────────────────────────────────────────────
    const env = {
      USERS_TABLE: this.usersTable.tableName,
      BURN_HISTORY_TABLE: this.burnHistoryTable.tableName,
      USER_POOL_ID: this.userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
    };

    const mkFn = (fnId: string, handler: string) => {
      const fn = new lambda.Function(this, fnId, {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler,
        code: lambda.Code.fromAsset('../../packages/backend/functions/enterprise'),
        timeout: cdk.Duration.seconds(15),
        environment: env,
      });
      this.usersTable.grantReadWriteData(fn);
      this.burnHistoryTable.grantReadWriteData(fn);
      return fn;
    };

    const registerFn = mkFn('EnterpriseRegisterFn', 'register.handler');
    const loginFn    = mkFn('EnterpriseLoginFn',    'login.handler');
    const burnFn     = mkFn('EnterpriseBurnFn',     'burn.handler');
    const meFn       = mkFn('EnterpriseMeFn',       'me.handler');

    // Cognito permissions for register/login
    registerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminSetUserPassword', 'cognito-idp:AdminInitiateAuth'],
      resources: [this.userPool.userPoolArn],
    }));
    loginFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:InitiateAuth'],
      resources: [this.userPool.userPoolArn],
    }));

    // Rewards distributor (stream trigger)
    const rewardsFn = new lambda.Function(this, 'RewardsDistributorFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'rewards-distributor.handler',
      code: lambda.Code.fromAsset('../../packages/backend/functions/enterprise'),
      timeout: cdk.Duration.seconds(30),
      environment: { ...env, HAZARDS_TABLE: props.hazardsTable.tableName },
    });
    this.usersTable.grantReadData(rewardsFn);
    props.hazardsTable.grantReadData(rewardsFn);
    rewardsFn.addEventSourceMapping('BurnStreamTrigger', {
      eventSourceArn: this.burnHistoryTable.tableStreamArn!,
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 1,
    });
    rewardsFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetRecords', 'dynamodb:GetShardIterator', 'dynamodb:DescribeStream', 'dynamodb:ListStreams'],
      resources: [this.burnHistoryTable.tableStreamArn!],
    }));

    // ── API Gateway ────────────────────────────────────────────────────────────
    this.api = new apigateway.RestApi(this, 'EnterpriseApi', {
      restApiName: 'vigia-enterprise',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const enterprise = this.api.root.addResource('enterprise');

    enterprise.addResource('register').addMethod('POST', new apigateway.LambdaIntegration(registerFn));
    enterprise.addResource('login').addMethod('POST',    new apigateway.LambdaIntegration(loginFn));

    // JWT authorizer for protected routes
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'EnterpriseAuthorizer', {
      cognitoUserPools: [this.userPool],
    });
    const authOpts: apigateway.MethodOptions = { authorizer, authorizationType: apigateway.AuthorizationType.COGNITO };

    enterprise.addResource('me').addMethod('GET',    new apigateway.LambdaIntegration(meFn),   authOpts);
    enterprise.addResource('burn').addMethod('POST', new apigateway.LambdaIntegration(burnFn), authOpts);

    // Outputs
    new cdk.CfnOutput(this, 'EnterpriseApiEndpoint', { value: this.api.url });
    new cdk.CfnOutput(this, 'UserPoolId',            { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId',      { value: userPoolClient.userPoolClientId });
  }
}
