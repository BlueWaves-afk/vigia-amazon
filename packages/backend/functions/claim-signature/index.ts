import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { KMSClient, SignCommand } from '@aws-sdk/client-kms';
import { ethers } from 'ethers';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const kms = new KMSClient({ region: 'us-east-1' });

const REWARDS_LEDGER_TABLE = process.env.REWARDS_LEDGER_TABLE_NAME!;
const KMS_KEY_ID = process.env.KMS_KEY_ID!;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '80002');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  try {
    const { wallet_address } = JSON.parse(event.body || '{}');
    if (!wallet_address) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'wallet_address required' }) };

    const checksummed = ethers.getAddress(wallet_address);

    // 1. Read pending balance + nonce
    const record = await dynamodb.send(new GetCommand({
      TableName: REWARDS_LEDGER_TABLE,
      Key: { wallet_address: checksummed },
    }));

    const item = record.Item;
    if (!item || !item.pending_balance || BigInt(item.pending_balance) === 0n) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'No pending rewards' }) };
    }

    const amount = BigInt(item.pending_balance);
    const nonce: number = item.nonce ?? 0;

    // 2. Construct message hash (matches VIGIA_BME.sol claimRewards)
    const packed = ethers.solidityPacked(
      ['address', 'uint256', 'uint256', 'uint256'],
      [checksummed, amount, nonce, CHAIN_ID]
    );
    const hash = ethers.keccak256(packed);
    const ethSignedHash = ethers.hashMessage(ethers.getBytes(hash));
    console.log('[ClaimSignature] packed hash:', hash, '| ethSignedHash:', ethSignedHash);

    // 3. Sign with AWS KMS (secp256k1 key)
    const { Signature: derSig, KeyId } = await kms.send(new SignCommand({
      KeyId: KMS_KEY_ID,
      Message: Buffer.from(ethSignedHash.slice(2), 'hex'),
      MessageType: 'DIGEST',
      SigningAlgorithm: 'ECDSA_SHA_256',
    }));

    // Derive KMS Ethereum address from public key (for v recovery)
    const { GetPublicKeyCommand } = await import('@aws-sdk/client-kms');
    const pubKeyRes = await kms.send(new GetPublicKeyCommand({ KeyId: KMS_KEY_ID }));
    const pubKeyDer = Buffer.from(pubKeyRes.PublicKey!);
    const uncompressedPoint = '0x' + pubKeyDer.slice(-65).toString('hex');
    const kmsAddress = ethers.computeAddress(uncompressedPoint);
    console.log('[ClaimSignature] KMS address derived:', kmsAddress);

    // Convert DER signature → Ethereum compact signature
    const sig = derToEthSig(derSig!, ethSignedHash, kmsAddress);

    // 4. Optimistic zero-out: save last_issued_signature for retry, clear pending_balance, increment total_claimed
    await dynamodb.send(new UpdateCommand({
      TableName: REWARDS_LEDGER_TABLE,
      Key: { wallet_address: checksummed },
      UpdateExpression:
        'SET pending_balance = :zero, nonce = :nextNonce, last_updated = :now, ' +
        'last_issued_signature = :sigData ' +
        'ADD total_claimed :amt',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':nextNonce': nonce + 1,
        ':now': new Date().toISOString(),
        ':sigData': { amount: amount.toString(), nonce, signature: sig },
        ':amt': BigInt(amount) as any,
      },
    }));

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount.toString(), nonce, signature: sig }),
    };
  } catch (e: any) {
    console.error('[ClaimSignature] Error:', e?.message ?? e);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to generate claim signature' }) };
  }
};

/** Convert AWS KMS DER-encoded secp256k1 signature to Ethereum 65-byte hex signature */
function derToEthSig(derSig: Uint8Array, msgHash: string, kmsAddress: string): string {
  let offset = 2;
  offset++; // skip 0x02
  const rLen = derSig[offset++];
  const r = derSig.slice(offset, offset + rLen);
  offset += rLen;
  offset++; // skip 0x02
  const sLen = derSig[offset++];
  const s = derSig.slice(offset, offset + sLen);

  const rHex = Buffer.from(r).toString('hex').replace(/^00/, '').padStart(64, '0');
  const sHex = Buffer.from(s).toString('hex').replace(/^00/, '').padStart(64, '0');

  console.log('[ClaimSignature] r:', rHex.slice(0, 16), 's:', sHex.slice(0, 16), 'kmsAddr:', kmsAddress);

  // Try v = 27 and 28, pick whichever recovers to the KMS address
  for (const v of [27, 28]) {
    const candidate = `0x${rHex}${sHex}${v.toString(16).padStart(2, '0')}`;
    try {
      const recovered = ethers.recoverAddress(msgHash, candidate);
      console.log('[ClaimSignature] v=', v, 'recovered:', recovered);
      if (recovered.toLowerCase() === kmsAddress.toLowerCase()) {
        return candidate;
      }
    } catch (e: any) {
      console.log('[ClaimSignature] v=', v, 'recover failed:', e.message);
    }
  }
  throw new Error(`Could not recover KMS address. kmsAddress=${kmsAddress} rHex=${rHex.slice(0,8)} sHex=${sHex.slice(0,8)}`);
}
