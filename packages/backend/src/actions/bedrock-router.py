import json
import os
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['HAZARDS_TABLE_NAME'])

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def query_hazards(event):
    print(f"[Router] query_hazards called with event: {json.dumps(event)}")
    
    # Extract geohash from Bedrock Agent format
    geohash = event.get('geohash')
    
    # Bedrock Agent passes parameters as array
    if not geohash and 'parameters' in event:
        for param in event['parameters']:
            if param.get('name') == 'geohash':
                geohash = param.get('value')
                break
    
    if isinstance(geohash, dict):
        geohash = geohash.get('value') or geohash.get('S')
    
    print(f"[Router] Extracted geohash: {geohash} (type: {type(geohash)})")
    
    radius_meters = event.get('radiusMeters', 500)
    hours_back = event.get('hoursBack', 24)
    
    # Ensure geohash is a string
    if not isinstance(geohash, str):
        error_msg = f'Invalid geohash type: {type(geohash)}'
        print(f"[Router] ERROR: {error_msg}")
        return {
            'statusCode': 400,
            'body': {'error': error_msg}
        }
    
    response = table.query(
        KeyConditionExpression='geohash = :gh',
        ExpressionAttributeValues={':gh': geohash}
    )
    
    hazards = response.get('Items', [])
    
    return {
        'statusCode': 200,
        'body': {
            'hazards': hazards,
            'count': len(hazards)
        }
    }

def calculate_score(event):
    similar_hazards = event.get('similarHazards', [])
    
    if not similar_hazards:
        return {
            'statusCode': 200,
            'body': {
                'verificationScore': 0,
                'breakdown': {
                    'countScore': 0,
                    'confidenceScore': 0,
                    'temporalScore': 0
                }
            }
        }
    
    count_score = min(len(similar_hazards) * 20, 40)
    
    avg_confidence = sum(float(h.get('confidence', 0)) for h in similar_hazards) / len(similar_hazards)
    confidence_score = avg_confidence * 30
    
    temporal_score = 30
    
    total_score = count_score + confidence_score + temporal_score
    
    return {
        'statusCode': 200,
        'body': {
            'verificationScore': round(total_score, 2),
            'breakdown': {
                'countScore': count_score,
                'confidenceScore': round(confidence_score, 2),
                'temporalScore': temporal_score
            }
        }
    }

def lambda_handler(event, context):
    api_path = event.get('apiPath', '')
    
    if api_path == '/query-hazards':
        result = query_hazards(event)
    elif api_path == '/calculate-score':
        result = calculate_score(event)
    else:
        result = {
            'statusCode': 404,
            'body': {'error': 'Unknown API path'}
        }
    
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': event.get('actionGroup', ''),
            'apiPath': api_path,
            'httpMethod': event.get('httpMethod', 'POST'),
            'httpStatusCode': result['statusCode'],
            'responseBody': {
                'application/json': {
                    'body': json.dumps(result['body'], cls=DecimalEncoder)
                }
            }
        }
    }
