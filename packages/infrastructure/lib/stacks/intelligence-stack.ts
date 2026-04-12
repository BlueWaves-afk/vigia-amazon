import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as location from 'aws-cdk-lib/aws-location';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';
import { BedrockAgentConfig } from '../constructs/bedrock-agent';

export interface IntelligenceStackProps {
  hazardsTable?: dynamodb.Table;
  ledgerTable: dynamodb.Table;
  maintenanceQueueTable?: dynamodb.Table;
  economicMetricsTable?: dynamodb.Table;
  deviceRegistryTable?: dynamodb.Table;
  framesBucket?: s3.Bucket;
}

export class IntelligenceStack extends Construct {
  public readonly cooldownTable: dynamodb.Table;
  public readonly tracesTable: dynamodb.Table;
  public readonly rewardsLedgerTable: dynamodb.Table;
  public readonly bedrockRouterFn: lambda.Function;
  public readonly networkIntelligenceFn?: lambda.Function;
  public readonly maintenanceLogisticsFn?: lambda.Function;
  public readonly urbanPlannerFn?: lambda.Function;
  public readonly urbanPlannerStateMachine?: sfn.StateMachine;
  public readonly geofenceCollection?: location.CfnGeofenceCollection;
  public readonly bedrockAgentConfig?: BedrockAgentConfig;
  public readonly verifyHazardSyncFn?: lambdaNodejs.NodejsFunction;
  public readonly claimSignatureFn?: lambdaNodejs.NodejsFunction;
  public readonly rewardsBalanceFn?: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: IntelligenceStackProps) {
    super(scope, id);

    // Cooldown Table (prevents duplicate Bedrock invocations)
    this.cooldownTable = new dynamodb.Table(this, 'CooldownTable', {
      partitionKey: { name: 'cooldownKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Agent Traces Table (stores Bedrock reasoning)
    this.tracesTable = new dynamodb.Table(this, 'AgentTracesTable', {
      partitionKey: { name: 'traceId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for querying by hazardId
    this.tracesTable.addGlobalSecondaryIndex({
      indexName: 'HazardIdIndex',
      partitionKey: { name: 'hazardId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // BME Rewards Ledger (off-chain pending balances)
    this.rewardsLedgerTable = new dynamodb.Table(this, 'RewardsLedgerTable', {
      partitionKey: { name: 'wallet_address', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Bedrock Action Router Lambda (Python) - only if hazards table provided
    if (props.hazardsTable) {
      this.bedrockRouterFn = new lambda.Function(this, 'BedrockRouterFunction', {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'bedrock-router.lambda_handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/src/actions')),
        timeout: cdk.Duration.seconds(30),
        environment: {
          HAZARDS_TABLE_NAME: props.hazardsTable.tableName,
        },
      });

      // Grant DynamoDB query access
      props.hazardsTable.grantReadData(this.bedrockRouterFn);

      // Grant Bedrock service permission to invoke this Lambda
      this.bedrockRouterFn.addPermission('AllowBedrockInvoke', {
        principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        action: 'lambda:InvokeFunction',
      });

      // Output Bedrock Router Lambda ARN
      new cdk.CfnOutput(this, 'BedrockRouterFunctionArn', {
        value: this.bedrockRouterFn.functionArn,
        description: 'ARN of Bedrock Action Router Lambda',
        exportName: 'BedrockRouterFunctionArn',
      });
    }

    // Lambda Orchestrator (triggered by DynamoDB Stream) - only if hazards table provided
    if (props.hazardsTable) {
      const orchestratorFn = new lambdaNodejs.NodejsFunction(this, 'OrchestratorFunction', {
        entry: path.join(__dirname, '../../../backend/src/orchestrator/index.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          externalModules: ['@aws-sdk/*'], // Use AWS SDK from Lambda runtime
        },
        environment: {
          COOLDOWN_TABLE_NAME: this.cooldownTable.tableName,
          TRACES_TABLE_NAME: this.tracesTable.tableName,
          HAZARDS_TABLE_NAME: props.hazardsTable.tableName,
          LEDGER_TABLE_NAME: props.ledgerTable.tableName,
          REWARDS_LEDGER_TABLE_NAME: this.rewardsLedgerTable.tableName,
          FRAMES_BUCKET_NAME: props.framesBucket?.bucketName ?? '',
          BEDROCK_AGENT_ID: process.env.BEDROCK_AGENT_ID || 'placeholder',
          BEDROCK_AGENT_ALIAS_ID: process.env.BEDROCK_AGENT_ALIAS_ID || 'placeholder',
        },
      });

      // Grant permissions
      this.cooldownTable.grantReadWriteData(orchestratorFn);
      this.tracesTable.grantWriteData(orchestratorFn);
      props.hazardsTable.grantReadWriteData(orchestratorFn);
      props.ledgerTable.grantWriteData(orchestratorFn);
      this.rewardsLedgerTable.grantWriteData(orchestratorFn);
      if (props.framesBucket) props.framesBucket.grantRead(orchestratorFn);

      orchestratorFn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['bedrock:InvokeAgent', 'bedrock:InvokeModel'],
        resources: ['*'],
      }));

      // Add DynamoDB Stream trigger
      orchestratorFn.addEventSource(
        new lambdaEventSources.DynamoEventSource(props.hazardsTable, {
          startingPosition: lambda.StartingPosition.LATEST,
          batchSize: 10,
          retryAttempts: 2,
        })
      );

      // Synchronous Verification Lambda (for interactive demo)
      this.verifyHazardSyncFn = new lambdaNodejs.NodejsFunction(this, 'VerifyHazardSyncFunction', {
        entry: path.join(__dirname, '../../../backend/functions/verify-hazard-sync/index.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(29), // Must be < 29s API Gateway limit
        memorySize: 256,
        bundling: {
          externalModules: ['@aws-sdk/*'],
          // ethers + ethers-aws-kms-signer are bundled inline by esbuild
        },
        environment: {
          TRACES_TABLE_NAME: this.tracesTable.tableName,
          HAZARDS_TABLE_NAME: props.hazardsTable.tableName,
          LEDGER_TABLE_NAME: props.ledgerTable.tableName,
          REWARDS_LEDGER_TABLE_NAME: this.rewardsLedgerTable.tableName,
          DEVICE_REGISTRY_TABLE_NAME: props.deviceRegistryTable?.tableName ?? '',
          BEDROCK_AGENT_ID: 'TAWWC3SQ0L',
          BEDROCK_AGENT_ALIAS_ID: 'TSTALIASID',
          POLYGON_AMOY_RPC_URL: 'https://rpc-amoy.polygon.technology/',
          KMS_KEY_ID: ssm.StringParameter.valueForStringParameter(this, '/vigia/KMS_KEY_ID'),
          VIGIA_CONTRACT_ADDRESS: ssm.StringParameter.valueForStringParameter(this, '/vigia/VIGIA_CONTRACT_ADDRESS'),
        },
      });

      // Grant permissions
      this.tracesTable.grantWriteData(this.verifyHazardSyncFn);
      props.hazardsTable.grantWriteData(this.verifyHazardSyncFn);
      props.ledgerTable.grantWriteData(this.verifyHazardSyncFn);
      this.rewardsLedgerTable.grantWriteData(this.verifyHazardSyncFn);
      if (props.deviceRegistryTable) {
        props.deviceRegistryTable.grantReadData(this.verifyHazardSyncFn);
      }
      this.verifyHazardSyncFn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['bedrock:InvokeAgent'],
          resources: ['*'],
        })
      );
      this.verifyHazardSyncFn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['kms:Sign', 'kms:GetPublicKey'],
          resources: [
            'arn:aws:kms:us-east-1:203800220566:key/ad6343de-0e67-4502-a230-db2a6210e6a7',
          ],
        })
      );

      // BME Claim Signature Lambda
      this.claimSignatureFn = new lambdaNodejs.NodejsFunction(this, 'ClaimSignatureFunction', {
        entry: path.join(__dirname, '../../../backend/functions/claim-signature/index.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(15),
        memorySize: 256,
        bundling: { externalModules: ['@aws-sdk/*'] },
        environment: {
          REWARDS_LEDGER_TABLE_NAME: this.rewardsLedgerTable.tableName,
          KMS_KEY_ID: ssm.StringParameter.valueForStringParameter(this, '/vigia/KMS_KEY_ID'),
          CHAIN_ID: '80002',
        },
      });
      this.rewardsLedgerTable.grantReadWriteData(this.claimSignatureFn);
      this.claimSignatureFn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['kms:Sign', 'kms:GetPublicKey'],
        resources: [
          'arn:aws:kms:us-east-1:203800220566:key/ad6343de-0e67-4502-a230-db2a6210e6a7',
        ],
      }));

      // BME Rewards Balance Lambda (read-only, no nonce consumption)
      this.rewardsBalanceFn = new lambdaNodejs.NodejsFunction(this, 'RewardsBalanceFunction', {
        entry: path.join(__dirname, '../../../backend/functions/rewards-balance/index.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        bundling: { externalModules: ['@aws-sdk/*'] },
        environment: { REWARDS_LEDGER_TABLE_NAME: this.rewardsLedgerTable.tableName },
      });
      this.rewardsLedgerTable.grantReadData(this.rewardsBalanceFn);

      // ═══════════════════════════════════════════════════════════
      // NEW: Agent Upgrade - 3 Additional Action Group Lambdas
      // ═══════════════════════════════════════════════════════════

      // Network Intelligence Lambda
      this.networkIntelligenceFn = new lambda.Function(this, 'NetworkIntelligenceFunction', {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'network-intelligence.lambda_handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/src/actions')),
        timeout: cdk.Duration.seconds(30),
        environment: {
          HAZARDS_TABLE_NAME: props.hazardsTable.tableName,
        },
      });

      props.hazardsTable.grantReadData(this.networkIntelligenceFn);

      // Maintenance Logistics Lambda
      this.maintenanceLogisticsFn = new lambda.Function(this, 'MaintenanceLogisticsFunction', {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'maintenance-logistics.lambda_handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/src/actions')),
        timeout: cdk.Duration.seconds(30),
        environment: {
          HAZARDS_TABLE_NAME: props.hazardsTable.tableName,
          MAINTENANCE_QUEUE_TABLE_NAME: props.maintenanceQueueTable?.tableName || '',
        },
      });

      props.hazardsTable.grantReadData(this.maintenanceLogisticsFn);
      if (props.maintenanceQueueTable) {
        props.maintenanceQueueTable.grantReadData(this.maintenanceLogisticsFn);
      }

      // Urban Planner Lambda
      const routeCalculatorName = `${cdk.Stack.of(this).stackName}-VigiaRouteCalculator`;

      this.urbanPlannerFn = new lambda.Function(this, 'UrbanPlannerFunction', {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'urban-planner.lambda_handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/src/actions')),
        timeout: cdk.Duration.seconds(30),
        environment: {
          HAZARDS_TABLE_NAME: props.hazardsTable.tableName,
          ECONOMIC_METRICS_TABLE_NAME: props.economicMetricsTable?.tableName || '',
          ROUTE_CALCULATOR_NAME: routeCalculatorName,
        },
      });

      props.hazardsTable.grantReadData(this.urbanPlannerFn);
      if (props.economicMetricsTable) {
        props.economicMetricsTable.grantReadData(this.urbanPlannerFn);
      }

      // Output Lambda ARNs
      new cdk.CfnOutput(this, 'NetworkIntelligenceFunctionArn', {
        value: this.networkIntelligenceFn.functionArn,
        description: 'ARN of Network Intelligence Lambda',
      });

      new cdk.CfnOutput(this, 'MaintenanceLogisticsFunctionArn', {
        value: this.maintenanceLogisticsFn.functionArn,
        description: 'ARN of Maintenance Logistics Lambda',
      });

      new cdk.CfnOutput(this, 'UrbanPlannerFunctionArn', {
        value: this.urbanPlannerFn.functionArn,
        description: 'ARN of Urban Planner Lambda',
      });

      // ═══════════════════════════════════════════════════════════
      // PHASE 3: Amazon Location Service Geofences & Route Calculator
      // ═══════════════════════════════════════════════════════════

      this.geofenceCollection = new location.CfnGeofenceCollection(this, 'VigiaRestrictedZones', {
        collectionName: 'VigiaRestrictedZones',
        description: 'Geofence collection for urban planning zone restrictions',
      });

      // Route Calculator for pin-based routing
      const routeCalculator = new location.CfnRouteCalculator(this, 'VigiaRouteCalculator', {
        calculatorName: routeCalculatorName,
        dataSource: 'Esri',
        description: 'Route calculator for fastest and safest path planning',
      });

      new cdk.CfnOutput(this, 'RouteCalculatorName', {
        value: routeCalculator.calculatorName!,
        description: 'Name of Location Service Route Calculator',
      });

      // Note: Geofences are added via API calls in the Lambda functions
      // The collection is created here, but individual geofences are managed dynamically
      // For demo purposes, we'll add them via AWS CLI or SDK after deployment:
      //
      // aws location put-geofence \
      //   --collection-name VigiaRestrictedZones \
      //   --geofence-id residential-zone-1 \
      //   --geometry 'Polygon=[[[-71.06,42.36],[-71.05,42.36],[-71.05,42.37],[-71.06,42.37],[-71.06,42.36]]]'
      //
      // Repeat for commercial-zone-1, industrial-zone-1, protected-zone-1

      // ═══════════════════════════════════════════════════════════
      // PHASE 1: Step Functions Urban Planner Workflow
      // ═══════════════════════════════════════════════════════════

      // Create 3 micro-Lambdas for Step Functions
      const generateBezierPathFn = new lambda.Function(this, 'GenerateBezierPathFunction', {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'generate-bezier-path.lambda_handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/src/actions/step-functions')),
        timeout: cdk.Duration.seconds(10),
        environment: {
          GEOFENCE_COLLECTION_NAME: this.geofenceCollection.collectionName!,
        },
      });

      const calculateLandCostFn = new lambda.Function(this, 'CalculateLandCostFunction', {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'calculate-land-cost.lambda_handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/src/actions/step-functions')),
        timeout: cdk.Duration.seconds(5),
      });

      const checkZoneRegulationsFn = new lambda.Function(this, 'CheckZoneRegulationsFunction', {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'check-zone-regulations.lambda_handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/src/actions/step-functions')),
        timeout: cdk.Duration.seconds(10),
        environment: {
          GEOFENCE_COLLECTION_NAME: this.geofenceCollection.collectionName!,
        },
      });

      // Grant Location Service permissions
      generateBezierPathFn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['geo:BatchEvaluateGeofences'],
          resources: [this.geofenceCollection.attrArn],
        })
      );

      checkZoneRegulationsFn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['geo:BatchEvaluateGeofences'],
          resources: [this.geofenceCollection.attrArn],
        })
      );

      // Load ASL definition and substitute Lambda ARNs
      const aslPath = path.join(__dirname, '../../../backend/src/workflows/urban-planner.asl.json');
      const aslTemplate = fs.readFileSync(aslPath, 'utf-8');
      const aslDefinition = aslTemplate
        .replace(/\$\{GenerateBezierPathLambdaArn\}/g, generateBezierPathFn.functionArn)
        .replace(/\$\{CalculateLandCostLambdaArn\}/g, calculateLandCostFn.functionArn)
        .replace(/\$\{CheckZoneRegulationsLambdaArn\}/g, checkZoneRegulationsFn.functionArn);

      // Create Step Functions State Machine (Express Workflow)
      this.urbanPlannerStateMachine = new sfn.StateMachine(this, 'UrbanPlannerStateMachine', {
        definitionBody: sfn.DefinitionBody.fromString(aslDefinition),
        stateMachineType: sfn.StateMachineType.EXPRESS,
        timeout: cdk.Duration.seconds(30),
      });

      // Grant State Machine permission to invoke Lambdas
      generateBezierPathFn.grantInvoke(this.urbanPlannerStateMachine);
      calculateLandCostFn.grantInvoke(this.urbanPlannerStateMachine);
      checkZoneRegulationsFn.grantInvoke(this.urbanPlannerStateMachine);

      // Grant Bedrock Agent permission to invoke State Machine
      this.urbanPlannerStateMachine.grantStartSyncExecution(
        new iam.ServicePrincipal('bedrock.amazonaws.com')
      );

      // Update Urban Planner Lambda to use State Machine as proxy
      this.urbanPlannerFn.addEnvironment('STATE_MACHINE_ARN', this.urbanPlannerStateMachine.stateMachineArn);
      this.urbanPlannerFn.addEnvironment('USE_STEP_FUNCTIONS', 'true');
      this.urbanPlannerStateMachine.grantStartSyncExecution(this.urbanPlannerFn);

      // Grant Location Service permissions for pin-based routing
      this.urbanPlannerFn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['geo:CalculateRoute'],
          resources: [routeCalculator.attrArn],
        })
      );

      // Output State Machine ARN
      new cdk.CfnOutput(this, 'UrbanPlannerStateMachineArn', {
        value: this.urbanPlannerStateMachine.stateMachineArn,
        description: 'ARN of Urban Planner Step Functions Workflow',
      });

      new cdk.CfnOutput(this, 'GeofenceCollectionName', {
        value: this.geofenceCollection.collectionName!,
        description: 'Name of Location Service Geofence Collection',
      });

      // ═══════════════════════════════════════════════════════════
      // Bedrock Agent Configuration Output
      // ═══════════════════════════════════════════════════════════

      this.bedrockAgentConfig = new BedrockAgentConfig(this, 'VigiaAgentConfig', {
        agentId: 'TAWWC3SQ0L',
        agentAliasId: 'TSTALIASID',
        actionGroupLambdas: {
          hazardVerification: this.bedrockRouterFn,
          networkIntelligence: this.networkIntelligenceFn,
          maintenanceLogistics: this.maintenanceLogisticsFn,
          urbanPlanner: this.urbanPlannerFn,
        },
      });
    }
  }
}
