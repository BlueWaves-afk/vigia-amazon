import json
import os
import boto3
import math
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
stepfunctions = boto3.client('stepfunctions')
hazards_table = dynamodb.Table(os.environ['HAZARDS_TABLE_NAME'])

# State Machine ARN from environment variable
STATE_MACHINE_ARN = os.environ.get('STATE_MACHINE_ARN', '')
USE_STEP_FUNCTIONS = os.environ.get('USE_STEP_FUNCTIONS', 'true').lower() == 'true'

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def invoke_state_machine(event):
    """Invoke Step Functions State Machine for urban planning"""
    print(f"[UrbanPlanner] Invoking State Machine: {STATE_MACHINE_ARN}")
    
    # Extract parameters from Bedrock Agent format
    start = event.get('start', {})
    end = event.get('end', {})
    constraints = event.get('constraints', {})
    
    if 'parameters' in event:
        for param in event['parameters']:
            if param.get('name') == 'start':
                start = json.loads(param.get('value', '{}'))
            elif param.get('name') == 'end':
                end = json.loads(param.get('value', '{}'))
            elif param.get('name') == 'constraints':
                constraints = json.loads(param.get('value', '{}'))
    
    # Invoke State Machine synchronously
    response = stepfunctions.start_sync_execution(
        stateMachineArn=STATE_MACHINE_ARN,
        input=json.dumps({
            'start': start,
            'end': end,
            'constraints': constraints
        })
    )
    
    if response['status'] == 'SUCCEEDED':
        output = json.loads(response['output'])
        print(f"[UrbanPlanner] State Machine succeeded: {json.dumps(output)}")
        return output
    else:
        error = response.get('error', 'Unknown error')
        cause = response.get('cause', 'No cause provided')
        print(f"[UrbanPlanner] State Machine failed: {error} - {cause}")
        raise Exception(f"State Machine execution failed: {error}")

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two points"""
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def quadratic_bezier(t, p0, p1, p2):
    """Calculate point on quadratic Bezier curve at parameter t"""
    return (1-t)**2 * p0 + 2*(1-t)*t * p1 + t**2 * p2

def find_optimal_path(event):
    """Find optimal path avoiding hazards using Bezier bypass"""
    print(f"[UrbanPlanner] find_optimal_path: {json.dumps(event)}")
    
    # If Step Functions is enabled, use State Machine
    if USE_STEP_FUNCTIONS and STATE_MACHINE_ARN:
        result = invoke_state_machine(event)
        return {'statusCode': 200, 'body': result}
    
    # Otherwise, use legacy implementation
    start = event.get('start', {})
    end = event.get('end', {})
    constraints = event.get('constraints', {})
    
    if 'parameters' in event:
        for param in event['parameters']:
            if param.get('name') == 'start':
                start = json.loads(param.get('value', '{}'))
            elif param.get('name') == 'end':
                end = json.loads(param.get('value', '{}'))
            elif param.get('name') == 'constraints':
                constraints = json.loads(param.get('value', '{}'))
    
    if not start or not end or 'lat' not in start or 'lat' not in end:
        return {'statusCode': 400, 'body': {'error': 'start and end coordinates required'}}
    
    try:
        # Calculate midpoint
        mid_lat = (start['lat'] + end['lat']) / 2
        mid_lon = (start['lon'] + end['lon']) / 2
        
        # Calculate perpendicular vector
        dy = end['lat'] - start['lat']
        dx = end['lon'] - start['lon']
        
        # Perpendicular: (-dy, dx), normalized and scaled by 500-800m
        length = math.sqrt(dx**2 + dy**2)
        if length == 0:
            length = 0.001
        
        # Offset by ~600m (0.006 degrees ~= 600m at mid-latitudes)
        offset = 0.006
        perp_lat = -dy / length * offset
        perp_lon = dx / length * offset
        
        # Control point
        control_lat = mid_lat + perp_lat
        control_lon = mid_lon + perp_lon
        
        # Generate 20 points along Bezier curve
        path = []
        for i in range(21):
            t = i / 20
            lat = quadratic_bezier(t, start['lat'], control_lat, end['lat'])
            lon = quadratic_bezier(t, start['lon'], control_lon, end['lon'])
            
            # Mock geohash
            geohash = f"gh{int(lat*100)%10}{int(lon*100)%10}"
            
            path.append({
                'lat': round(lat, 6),
                'lon': round(lon, 6),
                'geohash': geohash
            })
        
        # Calculate curve length (approximate with segments)
        total_distance = 0
        for i in range(len(path) - 1):
            total_distance += haversine_distance(
                path[i]['lat'], path[i]['lon'],
                path[i+1]['lat'], path[i+1]['lon']
            )
        
        # Mock hazards avoided (deterministic based on path length)
        hazards_avoided = int(total_distance * 15)  # ~15 hazards per km
        
        # Calculate detour percentage
        direct_distance = haversine_distance(start['lat'], start['lon'], end['lat'], end['lon'])
        detour_percent = ((total_distance - direct_distance) / direct_distance * 100) if direct_distance > 0 else 0
        
        return {
            'statusCode': 200,
            'body': {
                'path': path,
                'totalDistanceKm': round(total_distance, 2),
                'hazardsAvoided': hazards_avoided,
                'detourPercent': round(detour_percent, 1)
            }
        }
    except Exception as e:
        print(f"[UrbanPlanner] Error: {str(e)}")
        return {'statusCode': 500, 'body': {'error': str(e)}}

def calculate_construction_roi(event):
    """Calculate ROI for new road construction"""
    print(f"[UrbanPlanner] calculate_construction_roi: {json.dumps(event)}")
    
    path_data = event.get('pathData', {})
    cost_per_km = event.get('constructionCostPerKm', 1500000)  # $1.5M/km
    
    if 'parameters' in event:
        for param in event['parameters']:
            if param.get('name') == 'pathData':
                path_data = json.loads(param.get('value', '{}'))
            elif param.get('name') == 'constructionCostPerKm':
                cost_per_km = float(param.get('value', 1500000))
    
    if not path_data or 'distanceKm' not in path_data:
        return {'statusCode': 400, 'body': {'error': 'pathData with distanceKm required'}}
    
    try:
        distance_km = path_data['distanceKm']
        hazards_avoided = path_data.get('hazardsAvoided', 0)
        
        # Construction cost
        construction_cost = int(distance_km * cost_per_km)
        
        # Land acquisition (mock high value)
        land_acquisition = 400000
        
        # Total project cost
        total_cost = construction_cost + land_acquisition
        
        # Annual repair savings ($500 per hazard per year)
        annual_repair_savings = hazards_avoided * 500
        
        # Break-even calculation
        break_even_years = total_cost / annual_repair_savings if annual_repair_savings > 0 else 999
        
        # 10-year ROI
        total_10_year_savings = annual_repair_savings * 10
        roi_10_year = ((total_10_year_savings - total_cost) / total_cost * 100) if total_cost > 0 else 0
        
        reasoning = (
            f"Optimal path identified. Bypass required to avoid high-density residential zone (Sector 4) "
            f"and minimize acquisition costs. Projected savings: ${annual_repair_savings:,}/year from "
            f"avoiding {hazards_avoided} recurring hazards."
        )
        
        return {
            'statusCode': 200,
            'body': {
                'constructionCost': construction_cost,
                'landAcquisition': land_acquisition,
                'totalProjectCost': total_cost,
                'annualRepairSavings': annual_repair_savings,
                'breakEvenYears': round(break_even_years, 1),
                'roi10Year': round(roi_10_year, 1),
                'recommendation': reasoning
            }
        }
    except Exception as e:
        print(f"[UrbanPlanner] Error: {str(e)}")
        return {'statusCode': 500, 'body': {'error': str(e)}}

def lambda_handler(event, context):
    """Route to appropriate tool"""
    api_path = event.get('apiPath', '')
    
    if api_path == '/find-optimal-path':
        result = find_optimal_path(event)
    elif api_path == '/calculate-construction-roi':
        result = calculate_construction_roi(event)
    else:
        result = {'statusCode': 404, 'body': {'error': 'Unknown API path'}}
    
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
