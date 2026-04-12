"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_s3_1 = require("@aws-sdk/client-s3");
const ethers_1 = require("ethers");
const ngeohash_1 = __importDefault(require("ngeohash"));
const dynamodb = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({}));
const s3 = new client_s3_1.S3Client({});
const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
const handler = async (event) => {
    try {
        const payload = JSON.parse(event.body || '{}');
        const { hazardType, lat, lon, timestamp, confidence, signature, frame_base64 } = payload;
        // ECDSA device registry check (unchanged)
        const payloadStr = `VIGIA:${hazardType}:${lat}:${lon}:${timestamp}:${confidence}`;
        const recoveredAddress = ethers_1.ethers.verifyMessage(payloadStr, signature);
        const { Item } = await dynamodb.send(new lib_dynamodb_1.GetCommand({
            TableName: process.env.DEVICE_REGISTRY_TABLE_NAME,
            Key: { device_address: recoveredAddress },
        }));
        if (!Item) {
            return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'DEVICE_NOT_REGISTERED' }) };
        }
        const geohash = ngeohash_1.default.encode(lat, lon, 7);
        const hazardId = `${geohash}#${timestamp}`;
        // S3 Pointer Pattern — upload frame, store key (null if frame absent)
        let s3_key = null;
        if (frame_base64) {
            s3_key = `frames/${geohash}/${timestamp}.jpg`;
            await s3.send(new client_s3_1.PutObjectCommand({
                Bucket: process.env.FRAMES_BUCKET_NAME,
                Key: s3_key,
                Body: Buffer.from(frame_base64, 'base64'),
                ContentType: 'image/jpeg',
            }));
        }
        // Write PENDING — Orchestrator handles all AI
        await dynamodb.send(new lib_dynamodb_1.PutCommand({
            TableName: process.env.HAZARDS_TABLE_NAME,
            Item: {
                geohash, timestamp, hazardType, lat, lon, confidence, signature,
                driverWalletAddress: recoveredAddress,
                status: 'PENDING',
                s3_key,
                ttl: Math.floor(Date.now() / 1000) + 86400 * 30,
            },
        }));
        // 202 Accepted — zero AI ran here
        return { statusCode: 202, headers: CORS, body: JSON.stringify({ hazardId, status: 'PENDING' }) };
    }
    catch (error) {
        console.error('[Validator] Error:', error);
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'INTERNAL_ERROR' }) };
    }
};
exports.handler = handler;
