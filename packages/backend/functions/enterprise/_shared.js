// Shared helpers
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const ok  = (body) => ({ statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const err = (code, msg) => ({ statusCode: code, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: msg }) });

const genApiKey = () => 'vigia_live_' + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

module.exports = { ddb, GetCommand, PutCommand, UpdateCommand, QueryCommand, ok, err, genApiKey };
