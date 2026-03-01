import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class TrustStack extends Construct {
  public readonly ledgerTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // DePIN Ledger Table (append-only with hash chain)
    this.ledgerTable = new dynamodb.Table(this, 'LedgerTable', {
      partitionKey: { name: 'ledgerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Placeholder: Hash chain validator Lambda will be added in Phase 5
  }
}
