import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as path from 'path';

export interface IngestionStackProps {
  ledgerTable: dynamodb.Table;
  tracesTable: dynamodb.Table;
  deviceRegistryTable?: dynamodb.Table;
}

export class IngestionStack extends Construct {
  public readonly hazardsTable: dynamodb.Table;
  public readonly deviceRegistryTable: dynamodb.Table;
  public readonly framesbucket: s3.Bucket;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: IngestionStackProps) {
    super(scope, id);

    // DynamoDB Hazards Table (Zone 2)
    this.hazardsTable = new dynamodb.Table(this, 'HazardsTable', {
      partitionKey: { name: 'geohash', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Dev only
    });

    // GSI for querying by status
    this.hazardsTable.addGlobalSecondaryIndex({
      indexName: 'status-timestamp-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for H3-based geospatial deduplication: query by h3_index + hazardType within a time window
    this.hazardsTable.addGlobalSecondaryIndex({
      indexName: 'h3-hazardtype-index',
      partitionKey: { name: 'h3_index', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'hazardType', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['timestamp', 'status'],
    });

    // VigiaDeviceRegistry — one record per edge node, keyed by Ethereum address
    this.deviceRegistryTable = new dynamodb.Table(this, 'DeviceRegistryTable', {
      tableName: 'VigiaDeviceRegistry',
      partitionKey: { name: 'device_address', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3 bucket for hazard frames (S3 Pointer Pattern)
    this.framesbucket = new s3.Bucket(this, 'HazardFramesBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(30) }],
    });

    // register-device Lambda
    const registerDeviceFn = new lambdaNodejs.NodejsFunction(this, 'RegisterDeviceFunction', {
      entry: path.join(__dirname, '../../../backend/functions/register-device/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: { externalModules: ['@aws-sdk/*'] },
      environment: { DEVICE_REGISTRY_TABLE_NAME: this.deviceRegistryTable.tableName },
    });
    this.deviceRegistryTable.grantWriteData(registerDeviceFn);

    // Lambda Validator Function
    const validatorFn = new lambdaNodejs.NodejsFunction(this, 'ValidatorFunction', {
      entry: path.join(__dirname, '../../../backend/src/validator/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: { externalModules: ['@aws-sdk/*'] },
      environment: {
        HAZARDS_TABLE_NAME: this.hazardsTable.tableName,
        DEVICE_REGISTRY_TABLE_NAME: this.deviceRegistryTable.tableName,
        FRAMES_BUCKET_NAME: this.framesbucket.bucketName,
      },
    });

    // Grant permissions
    this.hazardsTable.grantWriteData(validatorFn);
    this.deviceRegistryTable.grantReadData(validatorFn);
    this.framesbucket.grantPut(validatorFn);

    // API Gateway
    this.api = new apigateway.RestApi(this, 'VigiaAPI', {
      restApiName: 'VIGIA Telemetry API',
      description: 'Ingestion endpoint for hazard telemetry',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Telemetry model for request validation
    const telemetryModel = this.api.addModel('TelemetryModel', {
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['hazardType', 'lat', 'lon', 'timestamp', 'confidence', 'signature'],
        properties: {
          hazardType: { 
            type: apigateway.JsonSchemaType.STRING, 
            enum: ['POTHOLE', 'DEBRIS', 'ACCIDENT', 'ANIMAL'] 
          },
          lat: { type: apigateway.JsonSchemaType.NUMBER, minimum: -90, maximum: 90 },
          lon: { type: apigateway.JsonSchemaType.NUMBER, minimum: -180, maximum: 180 },
          timestamp: { type: apigateway.JsonSchemaType.STRING, format: 'date-time' },
          confidence: { type: apigateway.JsonSchemaType.NUMBER, minimum: 0, maximum: 1 },
          signature: { type: apigateway.JsonSchemaType.STRING },
          driverWalletAddress: { type: apigateway.JsonSchemaType.STRING },
        },
      },
    });

    // POST /telemetry endpoint
    const telemetry = this.api.root.addResource('telemetry');
    telemetry.addMethod('POST', new apigateway.LambdaIntegration(validatorFn), {
      requestValidator: new apigateway.RequestValidator(this, 'TelemetryValidator', {
        restApi: this.api,
        validateRequestBody: true,
      }),
      requestModels: {
        'application/json': telemetryModel,
      },
    });

    // Lambda Ledger Getter Function
    const ledgerGetterFn = new lambdaNodejs.NodejsFunction(this, 'LedgerGetterFunction', {
      entry: path.join(__dirname, '../../../backend/src/ledger/get-entries.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        LEDGER_TABLE_NAME: props.ledgerTable.tableName,
      },
    });

    // Grant read access to ledger table
    props.ledgerTable.grantReadData(ledgerGetterFn);

    // GET /ledger endpoint
    const ledger = this.api.root.addResource('ledger');
    ledger.addMethod('GET', new apigateway.LambdaIntegration(ledgerGetterFn));

    // Lambda Traces Getter Function
    const tracesGetterFn = new lambdaNodejs.NodejsFunction(this, 'TracesGetterFunction', {
      entry: path.join(__dirname, '../../../backend/src/traces/get-latest.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        TRACES_TABLE_NAME: props.tracesTable.tableName,
      },
    });

    // Grant read access to traces table
    props.tracesTable.grantReadData(tracesGetterFn);

    // GET /traces endpoint
    const traces = this.api.root.addResource('traces', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });
    traces.addMethod('GET', new apigateway.LambdaIntegration(tracesGetterFn));

    // Lambda Traces By Hazard Getter Function
    const tracesByHazardFn = new lambdaNodejs.NodejsFunction(this, 'TracesByHazardFunction', {
      entry: path.join(__dirname, '../../../backend/src/traces/get-by-hazard.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        TRACES_TABLE_NAME: props.tracesTable.tableName,
      },
    });

    // Grant read access to traces table
    props.tracesTable.grantReadData(tracesByHazardFn);

    // GET /traces/{hazardId} endpoint
    const tracesByHazard = traces.addResource('{hazardId}');
    tracesByHazard.addMethod('GET', new apigateway.LambdaIntegration(tracesByHazardFn));

    // Lambda Hazards Getter Function
    const hazardsGetterFn = new lambdaNodejs.NodejsFunction(this, 'HazardsGetterFunction', {
      entry: path.join(__dirname, '../../../backend/src/hazards/get-hazards.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        HAZARDS_TABLE_NAME: this.hazardsTable.tableName,
      },
    });

    // Grant read access to hazards table
    this.hazardsTable.grantReadData(hazardsGetterFn);

    // GET /hazards endpoint
    const hazards = this.api.root.addResource('hazards', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });
    hazards.addMethod('GET', new apigateway.LambdaIntegration(hazardsGetterFn), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
    });

    // POST /register-device endpoint
    const registerDevice = this.api.root.addResource('register-device');
    registerDevice.addMethod('POST', new apigateway.LambdaIntegration(registerDeviceFn));
  }
}
