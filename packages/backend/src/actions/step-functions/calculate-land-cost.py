import json
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def lambda_handler(event, context):
    # Check if this is ROI calculation or initial cost calculation
    if event.get('calculateROI'):
        # ROI calculation mode
        total_distance_km = event['totalDistanceKm']
        hazards_avoided = event['hazardsAvoided']
        land_acquisition = event['landAcquisition']
        construction_cost_per_km = event['constructionCostPerKm']
        
        construction_cost = int(total_distance_km * construction_cost_per_km)
        total_project_cost = construction_cost + land_acquisition
        annual_repair_savings = hazards_avoided * 500
        
        break_even_years = round(total_project_cost / annual_repair_savings, 1) if annual_repair_savings > 0 else 999
        roi_10_year = round(((annual_repair_savings * 10 - total_project_cost) / total_project_cost) * 100, 1)
        
        return {
            'path': event.get('path', []),
            'totalDistanceKm': total_distance_km,
            'hazardsAvoided': hazards_avoided,
            'detourPercent': event.get('detourPercent', 0),
            'constructionCost': construction_cost,
            'landAcquisition': land_acquisition,
            'totalProjectCost': total_project_cost,
            'annualRepairSavings': annual_repair_savings,
            'breakEvenYears': break_even_years,
            'roi10Year': roi_10_year,
            'compliance': event.get('compliance', {}),
            'zoneIntersections': event.get('zoneIntersections', []),
            'recommendation': f'Optimal path identified. Break-even: {break_even_years} years. ROI: {roi_10_year}%'
        }
    else:
        # Initial cost calculation mode
        start = event['start']
        end = event['end']
        
        distance_km = haversine(start['lat'], start['lon'], end['lat'], end['lon'])
        
        # Base construction cost: $1.5M per km
        construction_cost_per_km = 1500000
        
        # Land acquisition: $400k base + $50k per km
        land_acquisition = 400000 + int(distance_km * 50000)
        
        return {
            'landAcquisition': land_acquisition,
            'constructionCostPerKm': construction_cost_per_km
        }
