import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { createVerify } from 'crypto';
import ngeohash from 'ngeohash';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const secretsManager = new SecretsManagerClient({});

let cachedPublicKey: string | null = null;

async function getPublicKey(): Promise<string> {
  if (cachedPublicKey) return cachedPublicKey;
  
  const response = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: process.env.PUBLIC_KEY_SECRET_ARN })
  );
  
  cachedPublicKey = response.SecretString!;
  return cachedPublicKey;
}

function verifySignature(payload: any, publicKeyPem: string): boolean {
  try {
    const dataToSign = JSON.stringify({
      hazardType: payload.hazardType,
      lat: payload.lat,
      lon: payload.lon,
      timestamp: payload.timestamp,
      confidence: payload.confidence,
    });
    
    const verify = createVerify('SHA256');
    verify.update(dataToSign);
    verify.end();
    
    const signature = Buffer.from(payload.signature, 'base64');
    return verify.verify(publicKeyPem, signature);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const payload = JSON.parse(event.body || '{}');
    
    // Test mode bypass
    if (process.env.TEST_MODE === 'true' && payload.signature === 'TEST_MODE_SIGNATURE') {
      console.log('[Validator] Test mode: bypassing signature verification');
    } else {
      // Verify signature
      const publicKey = await getPublicKey();
      const isValid = verifySignature(payload, publicKey);
      
      if (!isValid) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'INVALID_SIGNATURE' }),
        };
      }
    }
    
    // Compute geohash
    const geohash = ngeohash.encode(payload.lat, payload.lon, 7);
    
    console.log(`[Validator] Writing hazard: ${geohash}#${payload.timestamp}`);
    
    // Write to DynamoDB
    await dynamodb.send(new PutCommand({
      TableName: process.env.HAZARDS_TABLE_NAME,
      Item: {
        geohash,
        timestamp: payload.timestamp,
        hazardType: payload.hazardType,
        lat: payload.lat,
        lon: payload.lon,
        confidence: payload.confidence,
        signature: payload.signature,
        status: 'pending',
        ttl: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
      },
    }));
    
    console.log(`[Validator] Successfully wrote hazard: ${geohash}#${payload.timestamp}`);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Validator error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'INTERNAL_ERROR' }),
    };
  }
};
