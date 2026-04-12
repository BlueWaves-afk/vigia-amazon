# Pin-Based Route Planning Feature - Implementation Spec

**Date**: 2026-03-07 04:07 AM IST  
**Status**: 🚧 IN PROGRESS

---

## 🎯 Feature Overview

Allow users to drop 2 pins on the map and ask the agent to find:
1. **Fastest Path** - Shortest route ignoring hazards
2. **Safest Path** - Route that avoids high-density hazard areas

The agent will:
- Query DynamoDB for hazards along potential routes
- Use AWS Location Service for routing calculations
- Return both paths with metrics (distance, hazards avoided, time)
- Frontend plots both paths on map for visual comparison

---

## 🏗️ Architecture

```
User drops 2 pins on map
    ↓
Frontend sends coordinates to agent
    ↓
Bedrock Agent (Urban Planner)
    ├─ Calls AWS Location Service (fastest route)
    ├─ Queries DynamoDB (hazards along route)
    └─ Calculates safest route (avoids hazards)
    ↓
Returns both paths as GeoJSON
    ↓
Frontend plots on map with different colors
```

---

## 📋 Implementation Tasks

### Phase 1: Frontend - Pin Dropping ✅
- [ ] Add pin drop mode to LiveMap
- [ ] Store 2 pin coordinates in state
- [ ] Show "Find Routes" button when 2 pins placed
- [ ] Clear pins functionality

### Phase 2: Agent Integration ✅
- [ ] Update Urban Planner Lambda to use AWS Location Service
- [ ] Add route calculation function
- [ ] Add hazard density analysis along route
- [ ] Return both fastest and safest paths

### Phase 3: Route Visualization ✅
- [ ] Plot fastest path (blue line)
- [ ] Plot safest path (green line)
- [ ] Show metrics panel (distance, time, hazards)
- [ ] Toggle between routes

---

## 🔧 Technical Details

### AWS Location Service Integration

**Service**: Amazon Location Service Routes API

**API Call**:
```python
import boto3

location_client = boto3.client('location', region_name='us-east-1')

response = location_client.calculate_route(
    CalculatorName='VigiaRouteCalculator',
    DeparturePosition=[start_lon, start_lat],
    DestinationPosition=[end_lon, end_lat],
    TravelMode='Car',
    DistanceUnit='Kilometers'
)

# Returns: route geometry, distance, duration
```

**CDK Setup**:
```typescript
const routeCalculator = new location.CfnRouteCalculator(this, 'RouteCalculator', {
  calculatorName: 'VigiaRouteCalculator',
  dataSource: 'Esri', // or 'Here'
});
```

---

### Hazard Density Analysis

**Algorithm**:
1. Get route geometry (list of coordinates)
2. For each segment, query hazards within 500m buffer
3. Calculate hazard density per km
4. Identify high-risk segments

**Code**:
```python
def analyze_route_hazards(route_coords, hazards_table):
    total_hazards = 0
    high_risk_segments = []
    
    for i in range(len(route_coords) - 1):
        segment_hazards = query_hazards_near_segment(
            route_coords[i], 
            route_coords[i+1], 
            buffer_meters=500
        )
        
        if len(segment_hazards) > 5:  # High density threshold
            high_risk_segments.append(i)
        
        total_hazards += len(segment_hazards)
    
    return {
        'total_hazards': total_hazards,
        'high_risk_segments': high_risk_segments,
        'hazards_per_km': total_hazards / route_distance_km
    }
```

---

### Safest Route Calculation

**Strategy**: Waypoint-based routing to avoid hazard clusters

**Algorithm**:
1. Get fastest route from Location Service
2. Identify hazard clusters along route
3. Generate waypoints to avoid clusters
4. Recalculate route with waypoints
5. Compare: if detour > 30%, use fastest route

**Code**:
```python
def calculate_safest_route(start, end, hazards):
    # Get fastest route
    fastest = location_client.calculate_route(
        DeparturePosition=[start['lon'], start['lat']],
        DestinationPosition=[end['lon'], end['lat']]
    )
    
    # Find hazard clusters
    clusters = find_hazard_clusters(hazards, fastest['Legs'][0]['Geometry'])
    
    if not clusters:
        return fastest  # No hazards, use fastest
    
    # Generate avoidance waypoints
    waypoints = generate_avoidance_waypoints(clusters)
    
    # Recalculate with waypoints
    safest = location_client.calculate_route(
        DeparturePosition=[start['lon'], start['lat']],
        DestinationPosition=[end['lon'], end['lat']],
        WaypointPositions=waypoints
    )
    
    # Check if detour is acceptable
    detour_percent = (safest['Summary']['Distance'] - fastest['Summary']['Distance']) / fastest['Summary']['Distance'] * 100
    
    if detour_percent > 30:
        return fastest  # Too much detour, use fastest
    
    return safest
```

---

## 📊 Data Structures

### Pin State
```typescript
interface Pin {
  id: string;
  lat: number;
  lon: number;
  label: 'A' | 'B';
}

const [pins, setPins] = useState<Pin[]>([]);
```

### Route Response
```typescript
interface RouteResult {
  fastest: {
    geometry: [number, number][],  // [lon, lat] pairs
    distance_km: number,
    duration_minutes: number,
    hazards_count: number,
  },
  safest: {
    geometry: [number, number][],
    distance_km: number,
    duration_minutes: number,
    hazards_count: number,
    hazards_avoided: number,
    detour_percent: number,
  },
  recommendation: string,
}
```

---

## 🎨 UI Design

### Pin Markers
- **Pin A**: Red marker with "A" label
- **Pin B**: Blue marker with "B" label
- Draggable after placement

### Route Lines
- **Fastest Route**: Blue dashed line (3px)
- **Safest Route**: Green solid line (3px)
- Hover shows metrics tooltip

### Metrics Panel
```
┌─────────────────────────────────────┐
│ Route Comparison                    │
├─────────────────────────────────────┤
│ Fastest Route (Blue)                │
│   Distance: 5.2 km                  │
│   Time: 12 min                      │
│   Hazards: 8 potholes               │
│                                     │
│ Safest Route (Green)                │
│   Distance: 6.1 km (+17%)           │
│   Time: 14 min (+2 min)             │
│   Hazards: 2 potholes               │
│   Avoided: 6 potholes               │
│                                     │
│ Recommendation: Use safest route    │
│ Saves 6 hazards for +0.9 km detour │
└─────────────────────────────────────┘
```

---

## 🔐 Security & Permissions

### IAM Policy for Lambda
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "geo:CalculateRoute"
      ],
      "Resource": "arn:aws:geo:us-east-1:*:route-calculator/VigiaRouteCalculator"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/VigiaStack-IngestionHazardsTable*"
    }
  ]
}
```

---

## 💰 Cost Estimate

**AWS Location Service**:
- Route calculations: $0.50 per 1,000 requests
- 100 route queries/day = $0.015/day = $0.45/month

**DynamoDB**:
- Hazard queries: ~10 queries per route
- 100 routes/day = 1,000 queries/day
- Within free tier (25 RCU)

**Total**: ~$0.50/month

---

## 🧪 Testing Plan

### Test 1: Pin Placement
1. Open session with hazards
2. Click "Drop Pin" button
3. Click map location → Pin A appears
4. Click another location → Pin B appears
5. Verify: "Find Routes" button enabled

### Test 2: Route Calculation
1. Place 2 pins (Boston: 42.36,-71.06 to 42.37,-71.05)
2. Click "Find Routes"
3. Wait for agent response (~3-5s)
4. Verify: Both routes appear on map
5. Verify: Metrics panel shows data

### Test 3: Route Comparison
1. Calculate routes
2. Hover over blue line → See fastest route metrics
3. Hover over green line → See safest route metrics
4. Toggle routes on/off
5. Verify: Safest route avoids hazard clusters

---

## 📈 Success Metrics

- [ ] Pin placement works smoothly
- [ ] Routes calculated in <5 seconds
- [ ] Safest route avoids ≥50% of hazards
- [ ] Detour is ≤30% longer
- [ ] Visual comparison is clear
- [ ] Agent provides actionable recommendation

---

## 🚀 Deployment Steps

1. Deploy CDK changes (Route Calculator)
2. Update Urban Planner Lambda
3. Deploy frontend changes
4. Test end-to-end
5. Update documentation

---

**Status**: Ready for implementation  
**Estimated Time**: 2-3 hours  
**Priority**: HIGH (Competition feature)
