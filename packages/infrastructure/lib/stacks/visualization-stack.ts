import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface VisualizationStackProps {
  hazardsTable: dynamodb.Table;
}

export class VisualizationStack extends Construct {
  constructor(scope: Construct, id: string, _props: VisualizationStackProps) {
    super(scope, id);

    // Placeholder: Amazon Location Service resources will be added in Phase 6
    // - Map (MapLibre GL JS)
    // - Route Calculator
    // - Route Hazard Analyzer Lambda
  }
}
