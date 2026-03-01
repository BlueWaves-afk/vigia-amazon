import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

export interface IngestionStackProps {
  ledgerTable: dynamodb.Table;
  tracesTable: dynamodb.Table;
}

export class IngestionStack extends Construct {
  public readonly hazardsTable: dynamodb.Table;
  public readonly api: apigateway.RestApi;
  public readonly publicKeySecret: secretsmanager.Secret;

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

    // Secrets Manager for public key
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEMIUfzeReTNy7Y6Vk0PZi9mxidpEe
N0xK7gprg8zInHZ7odGma+CeBbpavlw7C4X1AWFRR31XVgRszSmzFeBs/w==
-----END PUBLIC KEY-----`;

    this.publicKeySecret = new secretsmanager.Secret(this, 'PublicKeySecret', {
      secretName: 'vigia-public-key',
      description: 'ECDSA P-256 public key for telemetry signature verification',
      secretStringValue: cdk.SecretValue.unsafePlainText(publicKeyPem),
    });

    // Lambda Validator Function
    const validatorFn = new lambdaNodejs.NodejsFunction(this, 'ValidatorFunction', {
      entry: path.join(__dirname, '../../../backend/src/validator/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        externalModules: ['@aws-sdk/*'], // Use AWS SDK from Lambda runtime
      },
      environment: {
        HAZARDS_TABLE_NAME: this.hazardsTable.tableName,
        PUBLIC_KEY_SECRET_ARN: this.publicKeySecret.secretArn,
        TEST_MODE: process.env.TEST_MODE || 'true', // Enable test mode by default
      },
    });

    // Grant permissions
    this.hazardsTable.grantWriteData(validatorFn);
    this.publicKeySecret.grantRead(validatorFn);

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
    const hazards = this.api.root.addResource('hazards');
    hazards.addMethod('GET', new apigateway.LambdaIntegration(hazardsGetterFn));
  }
}
