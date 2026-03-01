import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

export interface IntelligenceStackProps {
  hazardsTable?: dynamodb.Table;
  ledgerTable: dynamodb.Table;
}

export class IntelligenceStack extends Construct {
  public readonly cooldownTable: dynamodb.Table;
  public readonly tracesTable: dynamodb.Table;
  public readonly bedrockRouterFn: lambda.Function;

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
          // Note: BEDROCK_AGENT_ID and BEDROCK_AGENT_ALIAS_ID must be set manually after Agent creation
          BEDROCK_AGENT_ID: process.env.BEDROCK_AGENT_ID || 'placeholder',
          BEDROCK_AGENT_ALIAS_ID: process.env.BEDROCK_AGENT_ALIAS_ID || 'placeholder',
        },
      });

      // Grant permissions
      this.cooldownTable.grantReadWriteData(orchestratorFn);
      this.tracesTable.grantWriteData(orchestratorFn);
      props.hazardsTable.grantReadWriteData(orchestratorFn);
      props.ledgerTable.grantWriteData(orchestratorFn);

      // Grant Bedrock Agent invocation permission
      orchestratorFn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['bedrock:InvokeAgent'],
          resources: ['*'], // Will be restricted after Agent creation
        })
      );

      // Add DynamoDB Stream trigger
      orchestratorFn.addEventSource(
        new lambdaEventSources.DynamoEventSource(props.hazardsTable, {
          startingPosition: lambda.StartingPosition.LATEST,
          batchSize: 10,
          retryAttempts: 2,
        })
      );
    }
  }
}
