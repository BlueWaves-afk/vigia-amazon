/**
 * VIGIA BME End-to-End Test
 * Tests the full lifecycle: verify → credit → claim-signature → on-chain claim → burn
 *
 * Run: KMS_KEY_ID=ad6343de-... VIGIA_CONTRACT_ADDRESS=0x... npx ts-node scripts/test-bme-e2e.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ethers } from 'ethers';

const TELEMETRY_API = 'https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod';
const INNOVATION_API = 'https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod';
const REWARDS_TABLE = process.env.REWARDS_LEDGER_TABLE_NAME || 'VigiaStack-IntelligenceWithHazardsRewardsLedgerTable';
const DRIVER_WALLET = '0x35b0Ec7B2172d1a1C8367C312246786632DE9427';
const CHAIN_ID = 80002;

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

const CLAIM_ABI = [
  'function claimRewards(uint256 amount, uint256 nonce, bytes calldata signature) external',
  'function balanceOf(address) view returns (uint256)',
  'function burnForDataCredits(uint256 amount) external',
  'function dataCredits(address) view returns (uint256)',
];

async function step(label: string, fn: () => Promise<any>) {
  process.stdout.write(`\n[TEST] ${label}... `);
  const result = await fn();
  console.log('✅');
  return result;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  VIGIA BME End-to-End Test');
  console.log('═══════════════════════════════════════════');

  // ── Step 1: Clean slate ──────────────────────────────────────────────────
  await step('Reset rewards ledger for test wallet', async () => {
    await dynamo.send(new DeleteCommand({
      TableName: REWARDS_TABLE,
      Key: { wallet_address: DRIVER_WALLET },
    }));
  });

  // ── Step 2: Simulate verified hazard → DynamoDB credit ───────────────────
  const hazardId = `drt2yzr#${new Date().toISOString()}`;
  const verifyRes = await step('POST /verify-hazard-sync (confidence=0.92)', async () => {
    const res = await fetch(`${TELEMETRY_API}/verify-hazard-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hazardId,
        hazardType: 'POTHOLE',
        lat: 42.3601, lon: -71.0589,
        confidence: 0.92,
        timestamp: new Date().toISOString(),
        geohash: 'drt2yzr',
        signature: 'TEST_MODE_SIGNATURE',
        driverWalletAddress: DRIVER_WALLET,
      }),
    });
    return res.json();
  });
  console.log(`    verificationScore=${verifyRes.verificationScore} rewardPending=${verifyRes.rewardPending}`);
  if (!verifyRes.rewardPending) throw new Error('Expected rewardPending=true');

  // ── Step 3: Verify DynamoDB was credited ─────────────────────────────────
  const ledgerRecord = await step('Read VigiaRewardsLedger', async () => {
    const r = await dynamo.send(new GetCommand({
      TableName: REWARDS_TABLE,
      Key: { wallet_address: DRIVER_WALLET },
    }));
    return r.Item;
  });
  console.log(`    pending_balance=${ledgerRecord?.pending_balance} nonce=${ledgerRecord?.nonce}`);
  if (BigInt(ledgerRecord?.pending_balance ?? 0) === 0n) throw new Error('pending_balance should be > 0');

  // ── Step 4: Request claim signature from AWS backend ─────────────────────
  const claimRes = await step('POST /claim-signature', async () => {
    const res = await fetch(`${INNOVATION_API}/claim-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: DRIVER_WALLET }),
    });
    return res.json();
  });
  console.log(`    amount=${claimRes.amount} nonce=${claimRes.nonce} sig=${claimRes.signature?.slice(0, 20)}...`);
  if (!claimRes.signature) throw new Error('No signature returned');

  // ── Step 5: Verify pending_balance was zeroed out ────────────────────────
  await step('Confirm optimistic zero-out in DynamoDB', async () => {
    const r = await dynamo.send(new GetCommand({
      TableName: REWARDS_TABLE,
      Key: { wallet_address: DRIVER_WALLET },
    }));
    if (Number(r.Item?.pending_balance ?? 1) !== 0) throw new Error('pending_balance should be 0 after claim');
    if (!r.Item?.last_issued_signature) throw new Error('last_issued_signature should be saved');
  });

  // ── Step 6: User submits claimRewards on-chain (user pays gas) ───────────
  const contractAddress = process.env.VIGIA_CONTRACT_ADDRESS;
  const rpcUrl = 'https://rpc-amoy.polygon.technology/';
  if (!contractAddress) {
    console.log('\n[SKIP] VIGIA_CONTRACT_ADDRESS not set — skipping on-chain steps');
    console.log('\n✅ Off-chain BME pipeline verified successfully!');
    return;
  }

  // Use a funded test wallet (set TEST_PRIVATE_KEY env var)
  const privateKey = process.env.TEST_PRIVATE_KEY;
  if (!privateKey) {
    console.log('\n[SKIP] TEST_PRIVATE_KEY not set — skipping on-chain claim');
    console.log('\n✅ Off-chain BME pipeline verified successfully!');
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const userWallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, CLAIM_ABI, userWallet);

  const balanceBefore = await step('Read on-chain VGA balance before claim', async () => {
    return contract.balanceOf(DRIVER_WALLET);
  });
  console.log(`    balance before: ${ethers.formatUnits(balanceBefore, 18)} VGA`);

  await step('Submit claimRewards on-chain (user pays gas)', async () => {
    const tx = await contract.claimRewards(claimRes.amount, claimRes.nonce, claimRes.signature);
    console.log(`\n    txHash: ${tx.hash}`);
    await tx.wait();
  });

  const balanceAfter = await step('Read on-chain VGA balance after claim', async () => {
    return contract.balanceOf(DRIVER_WALLET);
  });
  console.log(`    balance after: ${ethers.formatUnits(balanceAfter, 18)} VGA`);

  // ── Step 7: Enterprise burns tokens for Data Credits ─────────────────────
  await step('Enterprise burnForDataCredits(1 VGA)', async () => {
    const tx = await contract.burnForDataCredits(ethers.parseUnits('1', 18));
    await tx.wait();
  });

  const credits = await step('Read enterprise dataCredits', async () => {
    return contract.dataCredits(userWallet.address);
  });
  console.log(`    dataCredits: ${ethers.formatUnits(credits, 18)}`);

  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ Full BME lifecycle verified!');
  console.log('═══════════════════════════════════════════');
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
