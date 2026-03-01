import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IngestionStack } from './stacks/ingestion-stack';
import { IntelligenceStack } from './stacks/intelligence-stack';
import { TrustStack } from './stacks/trust-stack';
import { VisualizationStack } from './stacks/visualization-stack';
import { SessionStack } from './stacks/session-stack';
import { InnovationStack } from './stacks/innovation-stack';

export class VigiaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Zone 4: Trust Layer (DePIN Ledger)
    const trustStack = new TrustStack(this, 'Trust');

    // MFS: Session Management
    const sessionStack = new SessionStack(this, 'Session');

    // Zone 3: Intelligence Core - Create tables first (without hazards table)
    const intelligenceStack = new IntelligenceStack(this, 'Intelligence', {
      ledgerTable: trustStack.ledgerTable,
    });

    // Zone 2: Ingestion Funnel (API Gateway + Lambda + DynamoDB)
    const ingestionStack = new IngestionStack(this, 'Ingestion', {
      ledgerTable: trustStack.ledgerTable,
      tracesTable: intelligenceStack.tracesTable,
    });

    // Now create intelligence components that need hazards table
    const intelligenceWithHazardsStack = new IntelligenceStack(this, 'IntelligenceWithHazards', {
      hazardsTable: ingestionStack.hazardsTable,
      ledgerTable: trustStack.ledgerTable,
    });

    // Update ingestion stack to use the new traces table with GSI
    const tracesByHazardFn = ingestionStack.node.findChild('TracesByHazardFunction') as any;
    if (tracesByHazardFn) {
      tracesByHazardFn.addEnvironment('TRACES_TABLE_NAME', intelligenceWithHazardsStack.tracesTable.tableName);
      intelligenceWithHazardsStack.tracesTable.grantReadData(tracesByHazardFn);
    }

    // Zone 5: Visualization Layer (Amazon Location Service)
    new VisualizationStack(this, 'Visualization', {
      hazardsTable: ingestionStack.hazardsTable,
    });

    // Innovation Features Stack
    const innovationStack = new InnovationStack(this, 'Innovation', {
      hazardsTable: ingestionStack.hazardsTable,
    });

    // Stack outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: ingestionStack.api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'SessionApiEndpoint', {
      value: sessionStack.api.url,
      description: 'Session API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'InnovationApiEndpoint', {
      value: innovationStack.api.url,
      description: 'Innovation API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'HazardsTableName', {
      value: ingestionStack.hazardsTable.tableName,
      description: 'DynamoDB Hazards table name',
    });
  }
}

