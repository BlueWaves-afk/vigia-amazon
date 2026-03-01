import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class SessionStack extends Construct {
  public readonly sessionFilesTable: dynamodb.Table;
  public readonly ledgerEntriesTable: dynamodb.Table;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // SessionFiles Table
    this.sessionFilesTable = new dynamodb.Table(this, 'SessionFilesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI-1: geohash7-timestamp-index
    this.sessionFilesTable.addGlobalSecondaryIndex({
      indexName: 'geohash7-timestamp-index',
      partitionKey: { name: 'geohash7', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // GSI-2: status-timestamp-index
    this.sessionFilesTable.addGlobalSecondaryIndex({
      indexName: 'status-timestamp-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // LedgerEntries Table
    this.ledgerEntriesTable = new dynamodb.Table(this, 'LedgerEntriesTable', {
      partitionKey: { name: 'ledgerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Session CRUD Lambda
    const sessionCrudFunction = new nodejs.NodejsFunction(this, 'SessionCRUDFunction', {
      entry: path.join(__dirname, '../../../backend/src/sessions/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        SESSION_FILES_TABLE: this.sessionFilesTable.tableName,
        LEDGER_ENTRIES_TABLE: this.ledgerEntriesTable.tableName,
      },
    });

    this.sessionFilesTable.grantReadWriteData(sessionCrudFunction);
    this.ledgerEntriesTable.grantWriteData(sessionCrudFunction);

    // Geohash Resolver Lambda
    const geohashResolverFunction = new nodejs.NodejsFunction(this, 'GeohashResolverFunction', {
      entry: path.join(__dirname, '../../../backend/src/geohash/resolver.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
    });

    // Hash Chain Validator Lambda
    const hashChainValidatorFunction = new nodejs.NodejsFunction(this, 'HashChainValidatorFunction', {
      entry: path.join(__dirname, '../../../backend/src/ledger/validator.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      environment: {
        LEDGER_ENTRIES_TABLE: this.ledgerEntriesTable.tableName,
      },
    });

    this.ledgerEntriesTable.grantReadData(hashChainValidatorFunction);

    // API Gateway
    this.api = new apigateway.RestApi(this, 'SessionAPI', {
      restApiName: 'VIGIA Session API',
      description: 'API for Map-as-a-File-System session management',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // /sessions endpoint
    const sessions = this.api.root.addResource('sessions');
    sessions.addMethod('POST', new apigateway.LambdaIntegration(sessionCrudFunction));
    sessions.addMethod('GET', new apigateway.LambdaIntegration(sessionCrudFunction));

    const sessionItem = sessions.addResource('{sessionId}');
    sessionItem.addMethod('GET', new apigateway.LambdaIntegration(sessionCrudFunction));
    sessionItem.addMethod('PUT', new apigateway.LambdaIntegration(sessionCrudFunction));
    sessionItem.addMethod('DELETE', new apigateway.LambdaIntegration(sessionCrudFunction));

    const validateEndpoint = sessionItem.addResource('validate');
    validateEndpoint.addMethod('GET', new apigateway.LambdaIntegration(hashChainValidatorFunction));

    // /geohash/resolve endpoint
    const geohash = this.api.root.addResource('geohash');
    const resolve = geohash.addResource('resolve');
    resolve.addMethod('POST', new apigateway.LambdaIntegration(geohashResolverFunction));

    // Places Search Lambda
    const placesSearchFunction = new lambda.Function(this, 'PlacesSearchFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'search.handler',
      code: lambda.Code.fromAsset('../../packages/backend/dist/places'),
      environment: {
        LOCATION_API_KEY: process.env.LOCATION_API_KEY || '',
      },
      timeout: cdk.Duration.seconds(10),
    });

    // Grant permissions to call Amazon Location Service
    placesSearchFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'geo-places:SearchText',
        'geo-places:ReverseGeocode',
      ],
      resources: ['*'],
    }));

    // /places/search endpoint
    const places = this.api.root.addResource('places');
    const search = places.addResource('search');
    search.addMethod('POST', new apigateway.LambdaIntegration(placesSearchFunction));
  }
}
