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

def encode_geohash(lat, lon, precision=7):
    """Simple geohash encoder (no external dependencies)"""
    base32 = '0123456789bcdefghjkmnpqrstuvwxyz'
    lat_range = [-90.0, 90.0]
    lon_range = [-180.0, 180.0]
    geohash = []
    bits = 0
    bit = 0
    even = True
    
    while len(geohash) < precision:
        if even:
            mid = (lon_range[0] + lon_range[1]) / 2
            if lon > mid:
                bit |= (1 << (4 - bits))
                lon_range[0] = mid
            else:
                lon_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat > mid:
                bit |= (1 << (4 - bits))
                lat_range[0] = mid
            else:
                lat_range[1] = mid
        even = not even
        bits += 1
        
        if bits == 5:
            geohash.append(base32[bit])
            bits = 0
            bit = 0
    
    return ''.join(geohash)

def coordinates_to_geohash(event):
    """Convert lat/lon coordinates to geohash"""
    print(f"[Router] coordinates_to_geohash called with event: {json.dumps(event)}")
    
    # Extract parameters
    lat = lon = None
    if 'parameters' in event:
        for param in event['parameters']:
            if param.get('name') == 'latitude':
                lat = float(param.get('value'))
            elif param.get('name') == 'longitude':
                lon = float(param.get('value'))
    
    if lat is None or lon is None:
        return {
            'statusCode': 400,
            'body': {'error': 'latitude and longitude required'}
        }
    
    # Generate geohash (precision 7 for ~150m accuracy)
    geohash = encode_geohash(lat, lon, precision=7)
    
    return {
        'statusCode': 200,
        'body': {
            'geohash': geohash,
            'latitude': lat,
            'longitude': lon,
            'precision': 7
        }
    }

def scan_all_hazards(event):
    """Scan entire hazards table and return high-priority hazards"""
    print(f"[Router] scan_all_hazards called")
    
    # Extract optional filters
    min_confidence = 0.7
    limit = 100
    
    if 'parameters' in event:
        for param in event['parameters']:
            if param.get('name') == 'minConfidence':
                min_confidence = float(param.get('value', 0.7))
            elif param.get('name') == 'limit':
                limit = int(param.get('value', 100))
    
    # Scan table (with limit to avoid timeout)
    response = table.scan(Limit=limit)
    hazards = response.get('Items', [])
    
    # Filter by confidence and calculate priority
    high_priority = []
    for h in hazards:
        confidence = float(h.get('confidence', 0))
        if confidence >= min_confidence:
            # Calculate priority score
            verification_score = float(h.get('verificationScore', 50))
            hazard_type = h.get('hazardType', 'UNKNOWN')
            
            # Severity mapping
            severity_map = {
                'ACCIDENT': 100,
                'POTHOLE': 60,
                'DEBRIS': 40,
                'ANIMAL': 20
            }
            severity = severity_map.get(hazard_type, 30)
            
            # Priority = (severity * 0.5) + (verification * 0.3) + (confidence * 100 * 0.2)
            priority = (severity * 0.5) + (verification_score * 0.3) + (confidence * 100 * 0.2)
            
            high_priority.append({
                'hazardId': f"{h.get('geohash')}#{h.get('timestamp')}",
                'geohash': h.get('geohash'),
                'latitude': float(h.get('lat', 0)),
                'longitude': float(h.get('lon', 0)),
                'hazardType': hazard_type,
                'confidence': confidence,
                'verificationScore': verification_score,
                'priority': round(priority, 2),
                'timestamp': h.get('timestamp')
            })
    
    # Sort by priority descending
    high_priority.sort(key=lambda x: x['priority'], reverse=True)
    
    return {
        'statusCode': 200,
        'body': {
            'hazards': high_priority[:20],  # Return top 20
            'totalScanned': len(hazards),
            'highPriorityCount': len(high_priority)
        }
    }

def query_hazards(event):
    print(f"[Router] query_hazards called with event: {json.dumps(event)}")
    
    geohash = event.get('geohash')
    if not geohash and 'parameters' in event:
        for param in event['parameters']:
            if param.get('name') == 'geohash':
                geohash = param.get('value')
                break
    
    if isinstance(geohash, dict):
        geohash = geohash.get('value') or geohash.get('S')
    
    print(f"[Router] Extracted geohash: {geohash} (type: {type(geohash)})")
    
    if not isinstance(geohash, str):
        return {'statusCode': 400, 'body': {'error': f'Invalid geohash type: {type(geohash)}'}}
    
    response = table.query(
        KeyConditionExpression='geohash = :gh',
        ExpressionAttributeValues={':gh': geohash}
    )
    hazards = response.get('Items', [])

    # Compute verification score inline so the agent always gets a meaningful result
    # without needing a separate calculate_score call.
    computed_score = 0
    if hazards:
        count_score = min(len(hazards) * 20, 40)
        avg_conf = sum(float(h.get('confidence', 0)) for h in hazards) / len(hazards)
        confidence_score = avg_conf * 30
        temporal_score = 30
        computed_score = round(count_score + confidence_score + temporal_score, 2)

    print(f"[Router] query_hazards: found {len(hazards)} hazards, computed score: {computed_score}")

    return {
        'statusCode': 200,
        'body': {
            'hazards': hazards,
            'count': len(hazards),
            'computedVerificationScore': computed_score,
        }
    }

def calculate_score(event):
    similar_hazards = event.get('similarHazards', [])

    # Bedrock Agent passes parameters as array of {name, value} objects
    if not similar_hazards and 'parameters' in event:
        for param in event['parameters']:
            if param.get('name') == 'similarHazards':
                val = param.get('value', '[]')
                try:
                    similar_hazards = json.loads(val) if isinstance(val, str) else val
                except Exception:
                    similar_hazards = []
                break

    # Also check requestBody (alternate Bedrock format)
    if not similar_hazards:
        try:
            props = event.get('requestBody', {}).get('content', {}).get('application/json', {}).get('properties', [])
            for p in props:
                if p.get('name') == 'similarHazards':
                    similar_hazards = json.loads(p.get('value', '[]'))
                    break
        except Exception:
            pass

    if not similar_hazards:
        return {
            'statusCode': 200,
            'body': {
                'verificationScore': 0,
                'breakdown': {'countScore': 0, 'confidenceScore': 0, 'temporalScore': 0}
            }
        }

    count_score = min(len(similar_hazards) * 20, 40)
    # float() handles both plain floats and DynamoDB Decimal types
    avg_confidence = sum(float(h.get('confidence', 0)) for h in similar_hazards) / len(similar_hazards)
    confidence_score = avg_confidence * 30
    temporal_score = 30
    total_score = count_score + confidence_score + temporal_score

    print(f"[Router] calculate_score: {len(similar_hazards)} hazards, avg_conf={avg_confidence:.3f}, score={total_score:.2f}")

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
    
    # Normalize path (handle both /query-hazards and /query_hazards)
    api_path = api_path.replace('-', '_')
    
    if api_path == '/query_hazards':
        result = query_hazards(event)
    elif api_path == '/coordinates_to_geohash':
        result = coordinates_to_geohash(event)
    elif api_path == '/scan_all_hazards':
        result = scan_all_hazards(event)
    elif api_path == '/calculate_score':
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
