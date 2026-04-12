#!/usr/bin/env npx ts-node
/**
 * scripts/clean-legacy-ledger.ts
 * Deletes all LedgerTable items that have no txHash (legacy pre-upgrade records).
 * Usage: npx ts-node scripts/clean-legacy-ledger.ts
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const TABLE = 'VigiaStack-TrustLedgerTableD0EF6ED1-FSHKRP1596UJ';
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

async function main() {
  let deleted = 0;
  let lastKey: Record<string, any> | undefined;

  do {
    const res = await client.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'attribute_not_exists(txHash) OR txHash = :empty',
      ExpressionAttributeValues: { ':empty': '' },
      ExclusiveStartKey: lastKey,
    }));

    const items = res.Items ?? [];
    for (const item of items) {
      await client.send(new DeleteCommand({
        TableName: TABLE,
        Key: { ledgerId: item.ledgerId, timestamp: item.timestamp },
      }));
      deleted++;
    }

    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Deleted ${deleted} legacy ledger record(s) with no txHash.`);
}

main().catch(console.error);
