import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

interface InnovationStackProps {
  hazardsTable: dynamodb.Table;
}

export class InnovationStack extends Construct {
  public readonly agentTracesTable: dynamodb.Table;
  public readonly maintenanceQueueTable: dynamodb.Table;
  public readonly economicMetricsTable: dynamodb.Table;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: InnovationStackProps) {
    super(scope, id);

    // ─────────────────────────────────────────────────────────────
    // DynamoDB Tables
    // ─────────────────────────────────────────────────────────────

    // AgentTraces Table with TTL
    this.agentTracesTable = new dynamodb.Table(this, 'AgentTracesTable', {
      partitionKey: { name: 'traceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.agentTracesTable.addGlobalSecondaryIndex({
      indexName: 'GeohashIndex',
      partitionKey: { name: 'geohash', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
    });

    // MaintenanceQueue Table
    this.maintenanceQueueTable = new dynamodb.Table(this, 'MaintenanceQueueTable', {
      partitionKey: { name: 'reportId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'reportedAt', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.maintenanceQueueTable.addGlobalSecondaryIndex({
      indexName: 'GeohashIndex',
      partitionKey: { name: 'geohash', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'reportedAt', type: dynamodb.AttributeType.NUMBER },
    });

    this.maintenanceQueueTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'reportedAt', type: dynamodb.AttributeType.NUMBER },
    });

    // EconomicMetrics Table
    this.economicMetricsTable = new dynamodb.Table(this, 'EconomicMetricsTable', {
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─────────────────────────────────────────────────────────────
    // Lambda Functions
    // ─────────────────────────────────────────────────────────────

    // Routing Agent Branch Lambda
    const routingAgentBranchFn = new lambda.Function(this, 'RoutingAgentBranchFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/routing-agent-branch')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        ROUTING_AGENT_ID: process.env.ROUTING_AGENT_ID || 'placeholder',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Agent Trace Streamer Lambda (SSE)
    const agentTraceStreamerFn = new lambda.Function(this, 'AgentTraceStreamerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/agent-trace-streamer')),
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      environment: {
        ORCHESTRATOR_AGENT_ID: process.env.ORCHESTRATOR_AGENT_ID || 'placeholder',
        TRACES_TABLE_NAME: this.agentTracesTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.agentTracesTable.grantWriteData(agentTraceStreamerFn);

    // Maintenance Report Handler Lambda
    const maintenanceReportHandlerFn = new lambda.Function(this, 'MaintenanceReportHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/maintenance-report-handler')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        MAINTENANCE_QUEUE_TABLE: this.maintenanceQueueTable.tableName,
        ECONOMIC_METRICS_TABLE: this.economicMetricsTable.tableName,
        HAZARDS_TABLE: props.hazardsTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.maintenanceQueueTable.grantWriteData(maintenanceReportHandlerFn);
    this.economicMetricsTable.grantReadWriteData(maintenanceReportHandlerFn);
    props.hazardsTable.grantReadData(maintenanceReportHandlerFn);

    // Economic Metrics Query Lambda
    const economicMetricsQueryFn = new lambda.Function(this, 'EconomicMetricsQueryFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/economic-metrics-query')),
      timeout: cdk.Duration.seconds(5),
      memorySize: 256,
      environment: {
        ECONOMIC_METRICS_TABLE: this.economicMetricsTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.economicMetricsTable.grantReadData(economicMetricsQueryFn);

    // Maintenance Queue Query Lambda
    const maintenanceQueueQueryFn = new lambda.Function(this, 'MaintenanceQueueQueryFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/functions/maintenance-queue-query')),
      timeout: cdk.Duration.seconds(5),
      memorySize: 256,
      environment: {
        MAINTENANCE_QUEUE_TABLE: this.maintenanceQueueTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.maintenanceQueueTable.grantReadData(maintenanceQueueQueryFn);

    // ─────────────────────────────────────────────────────────────
    // API Gateway
    // ─────────────────────────────────────────────────────────────

    this.api = new apigateway.RestApi(this, 'InnovationApi', {
      restApiName: 'VIGIA Innovation API',
      description: 'API for innovation features',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // POST /routing-agent/branch
    const routingAgent = this.api.root.addResource('routing-agent');
    const branch = routingAgent.addResource('branch');
    branch.addMethod('POST', new apigateway.LambdaIntegration(routingAgentBranchFn));

    // GET /agent-traces/stream
    const agentTraces = this.api.root.addResource('agent-traces');
    const stream = agentTraces.addResource('stream');
    stream.addMethod('GET', new apigateway.LambdaIntegration(agentTraceStreamerFn));

    // POST /maintenance/report
    const maintenance = this.api.root.addResource('maintenance');
    const report = maintenance.addResource('report');
    report.addMethod('POST', new apigateway.LambdaIntegration(maintenanceReportHandlerFn));

    // GET /maintenance/queue
    const queue = maintenance.addResource('queue');
    queue.addMethod('GET', new apigateway.LambdaIntegration(maintenanceQueueQueryFn));

    // GET /economic/metrics
    const economic = this.api.root.addResource('economic');
    const metrics = economic.addResource('metrics');
    metrics.addMethod('GET', new apigateway.LambdaIntegration(economicMetricsQueryFn));

    // ─────────────────────────────────────────────────────────────
    // Outputs
    // ─────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'InnovationApiEndpoint', {
      value: this.api.url,
      description: 'Innovation API Gateway endpoint',
    });
  }
}
