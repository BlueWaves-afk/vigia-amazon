import { KMSClient, SignCommand, GetPublicKeyCommand } from '@aws-sdk/client-kms';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ethers } from 'ethers';

const kms = new KMSClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const KMS_KEY_ID       = process.env.KMS_KEY_ID!;
const CONTRACT_ADDRESS = process.env.VIGIA_CONTRACT_ADDRESS!;
const CHAIN_ID         = parseInt(process.env.CHAIN_ID || '80002');
const RPC_URL          = process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology/';
const DEVICE_REGISTRY  = process.env.DEVICE_REGISTRY_TABLE!;
const RELAYER_KEY      = process.env.RELAYER_PRIVATE_KEY!; // deployer wallet pays gas

const SLASH_ABI = ['function slash(address node, bytes32 hazardId, bytes calldata signature) external'];

/** Convert AWS KMS DER-encoded secp256k1 signature to Ethereum 65-byte hex (reused from claim-signature) */
function derToEthSig(derSig: Uint8Array, msgHash: string, kmsAddress: string): string {
  let offset = 2;
  offset++;
  const rLen = derSig[offset++];
  const r = derSig.slice(offset, offset + rLen); offset += rLen;
  offset++;
  const sLen = derSig[offset++];
  const s = derSig.slice(offset, offset + sLen);
  const rHex = Buffer.from(r).toString('hex').replace(/^00/, '').padStart(64, '0');
  const sHex = Buffer.from(s).toString('hex').replace(/^00/, '').padStart(64, '0');
  for (const v of [27, 28]) {
    const candidate = `0x${rHex}${sHex}${v.toString(16).padStart(2, '0')}`;
    try {
      if (ethers.recoverAddress(msgHash, candidate).toLowerCase() === kmsAddress.toLowerCase())
        return candidate;
    } catch {}
  }
  throw new Error(`KMS address recovery failed for slash`);
}

export const handler = async (event: { walletAddress: string; hazardId: string; reason: string }) => {
  const { walletAddress, hazardId, reason } = event;
  if (!walletAddress || !hazardId) throw new Error('walletAddress and hazardId required');

  const node = ethers.getAddress(walletAddress);
  // bytes32 representation of hazardId
  const hazardIdBytes32 = ethers.zeroPadValue(ethers.toUtf8Bytes(hazardId).slice(0, 32), 32);

  // 1. Build hash matching VIGIA_BME.sol slash()
  const packed = ethers.solidityPacked(['address', 'bytes32', 'uint256'], [node, hazardIdBytes32, CHAIN_ID]);
  const hash = ethers.keccak256(packed);
  const ethSignedHash = ethers.hashMessage(ethers.getBytes(hash));

  // 2. KMS sign
  const { Signature: derSig } = await kms.send(new SignCommand({
    KeyId: KMS_KEY_ID,
    Message: Buffer.from(ethSignedHash.slice(2), 'hex'),
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256',
  }));
  const pubKeyRes = await kms.send(new GetPublicKeyCommand({ KeyId: KMS_KEY_ID }));
  const kmsAddress = ethers.computeAddress('0x' + Buffer.from(pubKeyRes.PublicKey!).slice(-65).toString('hex'));
  const sig = derToEthSig(derSig!, ethSignedHash, kmsAddress);

  // 3. Submit slash() transaction (relayer pays gas)
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const relayer = new ethers.Wallet(RELAYER_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, SLASH_ABI, relayer);
  const tx = await contract.slash(node, hazardIdBytes32, sig);
  const receipt = await tx.wait();
  console.log(`[Slash] ✅ node=${node} hazardId=${hazardId} tx=${receipt.hash} reason=${reason}`);

  // 4. Mark blacklisted in DynamoDB DeviceRegistry
  await ddb.send(new UpdateCommand({
    TableName: DEVICE_REGISTRY,
    Key: { device_address: node },
    UpdateExpression: 'SET blacklisted = :t, slashed_at = :now, slash_reason = :r, slash_tx = :tx',
    ExpressionAttributeValues: { ':t': true, ':now': new Date().toISOString(), ':r': reason, ':tx': receipt.hash },
  }));

  return { slashed: true, node, hazardId, txHash: receipt.hash };
};
