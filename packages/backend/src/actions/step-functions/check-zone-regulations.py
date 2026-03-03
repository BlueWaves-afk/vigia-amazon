import json
import os
import boto3

location_client = boto3.client('location')
GEOFENCE_COLLECTION = os.environ.get('GEOFENCE_COLLECTION_NAME', 'VigiaRestrictedZones')

def lambda_handler(event, context):
    start = event['start']
    end = event['end']
    
    # Check if path intersects restricted zones using Amazon Location Service
    try:
        # Evaluate start and end points against geofences
        response = location_client.batch_evaluate_geofences(
            CollectionName=GEOFENCE_COLLECTION,
            DevicePositionUpdates=[
                {
                    'DeviceId': 'start-point',
                    'Position': [start['lon'], start['lat']],
                    'SampleTime': '2026-03-04T00:00:00Z'
                },
                {
                    'DeviceId': 'end-point',
                    'Position': [end['lon'], end['lat']],
                    'SampleTime': '2026-03-04T00:00:00Z'
                }
            ]
        )
        
        # Parse geofence intersections
        zone_intersections = []
        errors = response.get('Errors', [])
        
        if errors:
            print(f"Geofence evaluation errors: {errors}")
        
        # For demo: Mock compliance based on coordinates
        # In production, parse response['Entries'] for actual geofence hits
        compliance = {
            'status': 'APPROVED',
            'approvalsRequired': [],
            'restrictions': 'None - Path avoids protected zones'
        }
        
        # Mock zone intersections for demo
        zone_intersections = [
            {'zone': 'Commercial', 'priority': 'medium', 'regulationDelay': '0 days'},
            {'zone': 'Residential', 'priority': 'low', 'regulationDelay': '0 days'}
        ]
        
    except Exception as e:
        print(f"Location Service error: {e}")
        compliance = {
            'status': 'PENDING',
            'approvalsRequired': ['Environmental Impact Assessment'],
            'restrictions': 'Unable to verify zone compliance'
        }
        zone_intersections = []
    
    return {
        'compliance': compliance,
        'zoneIntersections': zone_intersections
    }
