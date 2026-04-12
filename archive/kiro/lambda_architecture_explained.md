# VIGIA Lambda Architecture - In-Depth Explanation

**Last Updated**: 2026-03-04  
**Status**: All 4 Lambdas Deployed & Tested

---

## Overview

VIGIA uses 4 Python Lambdas as "tools" for the Bedrock Agent. Each Lambda implements 2 functions, giving the agent 8 total capabilities.

---

## 1. Bedrock Router Lambda (Hazard Verification)

**ARN**: `arn:aws:lambda:us-east-1:203800220566:function:VigiaStack-BedrockRouterFunction-*`  
**Handler**: `bedrock-router.lambda_handler`  
**Action Group**: `QueryAndVerify`

### Tool 1: `query_hazards`

**Purpose**: Find similar hazards near a location

**Input**:
```json
{
  "geohash": "drt2yzr",
  "radiusMeters": 1000,
  "hoursBack": 168
}
```

**Process**:
1. Query DynamoDB HazardsTable with partition key = geohash
2. Filter by timestamp (last N hours)
3. Return all matching hazards

**Output**:
```json
{
  "hazards": [
    {
      "geohash": "drt2yzr",
      "timestamp": "2026-03-01T10:00:00Z",
      "hazardType": "POTHOLE",
      "confidence": 0.92,
      "lat": 42.3601,
      "lon": -71.0589
    }
  ],
  "count": 15
}
```

### Tool 2: `calculate_score`

**Purpose**: Compute verification score from similar hazards

**Input**:
```json
{
  "similarHazards": [
    {"hazardType": "POTHOLE", "confidence": 0.92, "timestamp": "2026-03-01T10:00:00Z"},
    {"hazardType": "POTHOLE", "confidence": 0.88, "timestamp": "2026-03-02T15:00:00Z"}
  ]
}
```

**Process**:
```python
# Count Score (max 40 points)
count_score = min(len(hazards) * 4, 40)

# Confidence Score (max 30 points)
avg_confidence = sum(h['confidence'] for h in hazards) / len(hazards)
confidence_score = avg_confidence * 30

# Temporal Score (max 30 points)
recent_count = count(hazards where age < 24 hours)
temporal_score = min(recent_count * 10, 30)

# Total
verification_score = count_score + confidence_score + temporal_score
```

**Output**:
```json
{
  "verificationScore": 85.4,
  "breakdown": {
    "countScore": 40,
    "confidenceScore": 27.0,
    "temporalScore": 18.4
  },
  "reasoning": "15 similar potholes found, avg confidence 90%, 2 recent reports"
}
```

---

## 2. Network Intelligence Lambda (DePIN Health)

**ARN**: `arn:aws:lambda:us-east-1:203800220566:function:VigiaStack-IntelligenceWithHazardsNetworkIntellige-*`  
**Handler**: `network-intelligence.lambda_handler`  
**Action Group**: `NetworkIntelligence`

### Tool 1: `analyze_node_connectivity`

**Purpose**: Measure DePIN network health in an area

**Input**:
```json
{
  "geohash": "drt2yzr",
  "radiusKm": 10
}
```

**Process**:
```python
# 1. Query hazards in geohash prefix (last 7 days)
geohash_prefix = geohash[:5]  # ~5km radius
hazards = query_dynamodb(geohash_prefix, last_7_days)

# 2. Extract unique contributors (DePIN nodes)
unique_contributors = set(h['signature'] for h in hazards)
active_node_count = len(unique_contributors)

# 3. Calculate geographic spread
unique_geohashes = set(h['geohash'] for h in hazards)
coverage_area_km2 = len(unique_geohashes) * 25  # Each geohash ~25km²

# 4. Compute health score
health_score = (
    (active_node_count * 20) +      # More nodes = healthier (max 100)
    (len(unique_geohashes) * 3) +   # More spread = better coverage
    (50 if recent_activity else 0)  # Bonus for activity in last 24h
)
health_score = min(health_score, 100)

# 5. Find last activity
last_activity = max(h['timestamp'] for h in hazards)
```

**Output**:
```json
{
  "activeNodeCount": 15,
  "geographicSpread": {
    "coverageAreaKm2": 200,
    "uniqueGeohashes": 8
  },
  "healthScore": 74.0,
  "lastActivityTimestamp": "2026-03-03T23:25:00Z"
}
```

**Health Score Interpretation**:
- 0-30: Critical (network failing)
- 31-60: Poor (sparse coverage)
- 61-80: Good (adequate coverage)
- 81-100: Excellent (dense, active network)

### Tool 2: `identify_coverage_gaps`

**Purpose**: Find areas with insufficient sensor coverage

**Input**:
```json
{
  "boundingBox": {
    "north": 42.37,
    "south": 42.35,
    "east": -71.05,
    "west": -71.07
  },
  "minReportsThreshold": 5
}
```

**Process**:
```python
# 1. Divide bounding box into 3x3 grid
lat_step = (north - south) / 3
lon_step = (east - west) / 3

gaps = []

# 2. For each cell in grid
for i in range(3):
    for j in range(3):
        lat = south + (i + 0.5) * lat_step
        lon = west + (j + 0.5) * lon_step
        
        # Generate geohash for cell center
        geohash = encode_geohash(lat, lon, precision=6)
        
        # Query hazards in this cell
        hazards = query_dynamodb(geohash)
        report_count = len(hazards)
        
        # Flag as gap if below threshold
        if report_count < minReportsThreshold:
            severity = (
                'HIGH' if report_count == 0 else
                'MEDIUM' if report_count < 3 else
                'LOW'
            )
            gaps.append({
                'geohash': geohash,
                'centerLat': lat,
                'centerLon': lon,
                'reportCount': report_count,
                'severity': severity
            })
```

**Output**:
```json
{
  "gapPolygons": [
    {
      "geohash": "drt2zp",
      "centerLat": 42.36,
      "centerLon": -71.06,
      "reportCount": 2,
      "severity": "MEDIUM"
    }
  ],
  "totalGaps": 3
}
```

---

## 3. Maintenance Logistics Lambda (Repair Management)

**ARN**: `arn:aws:lambda:us-east-1:203800220566:function:VigiaStack-IntelligenceWithHazardsMaintenanceLogis-*`  
**Handler**: `maintenance-logistics.lambda_handler`  
**Action Group**: `MaintenanceLogistics`

### Tool 1: `prioritize_repair_queue`

**Purpose**: Rank hazards by repair urgency

**Input**:
```json
{
  "hazardIds": [
    "drt2yzr#2026-03-01T10:00:00Z",
    "drt2zpd#2026-03-02T15:00:00Z"
  ],
  "trafficDensitySource": "MOCK"
}
```

**Process**:
```python
# 1. Fetch each hazard from DynamoDB
hazards = [get_hazard(id) for id in hazardIds]

# 2. For each hazard, calculate priority score
for hazard in hazards:
    # Severity component (40% weight)
    severity_map = {
        'POTHOLE': 60,
        'DEBRIS': 40,
        'ACCIDENT': 100,
        'ANIMAL': 20
    }
    severity_score = severity_map[hazard['hazardType']] * 0.4
    
    # Traffic density component (30% weight)
    # Mock: urban=80, suburban=50, rural=20
    traffic_score = get_traffic_density(hazard['geohash']) * 0.3
    
    # Age component (20% weight)
    age_hours = (now - hazard['timestamp']).total_seconds() / 3600
    age_score = min((age_hours / 24) * 20, 20)  # Max 20 points
    
    # Verification component (10% weight)
    verification_score = hazard.get('verificationScore', 50) * 0.1
    
    # Total priority
    priority = severity_score + traffic_score + age_score + verification_score
    
    # Generate reasoning
    reasoning = f"{hazard['hazardType']} in {traffic_type} area, " \
                f"{age_hours:.0f}h old, {verification_score:.0f}% verified"
    
    hazard['priority'] = priority
    hazard['reasoning'] = reasoning

# 3. Sort by priority descending
hazards.sort(key=lambda h: h['priority'], reverse=True)
```

**Output**:
```json
{
  "prioritizedQueue": [
    {
      "hazardId": "drt2yzr#2026-03-01T10:00:00Z",
      "hazardType": "POTHOLE",
      "priority": 76.5,
      "estimatedCost": 585,
      "reasoning": "POTHOLE in urban area, 48h old, 85% verified"
    },
    {
      "hazardId": "drt2zpd#2026-03-02T15:00:00Z",
      "hazardType": "DEBRIS",
      "priority": 52.0,
      "estimatedCost": 224,
      "reasoning": "DEBRIS in suburban area, 24h old, 60% verified"
    }
  ]
}
```

### Tool 2: `estimate_repair_cost`

**Purpose**: Calculate total repair cost for hazards

**Input**:
```json
{
  "hazardIds": [
    "drt2yzr#2026-03-01T10:00:00Z",
    "drt2zpd#2026-03-02T15:00:00Z"
  ]
}
```

**Process**:
```python
# Base cost mapping
BASE_COSTS = {
    'POTHOLE': 500,
    'DEBRIS': 200,
    'ACCIDENT': 5000,
    'ANIMAL': 100
}

total_cost = 0
breakdown = []

for hazard_id in hazardIds:
    hazard = get_hazard(hazard_id)
    
    # Base cost
    base_cost = BASE_COSTS[hazard['hazardType']]
    
    # Severity multiplier (based on verification score)
    verification_score = hazard.get('verificationScore', 50)
    severity_multiplier = verification_score / 100
    
    # Final cost = base * (1 + severity * 0.2)
    # Higher verification = higher cost (more severe)
    final_cost = base_cost * (1 + severity_multiplier * 0.2)
    
    total_cost += final_cost
    
    breakdown.append({
        'hazardId': hazard_id,
        'hazardType': hazard['hazardType'],
        'baseCost': base_cost,
        'severityMultiplier': severity_multiplier,
        'finalCost': round(final_cost, 2)
    })
```

**Output**:
```json
{
  "totalCost": 809.0,
  "breakdown": [
    {
      "hazardId": "drt2yzr#2026-03-01T10:00:00Z",
      "hazardType": "POTHOLE",
      "baseCost": 500,
      "severityMultiplier": 0.85,
      "finalCost": 585.0
    },
    {
      "hazardId": "drt2zpd#2026-03-02T15:00:00Z",
      "hazardType": "DEBRIS",
      "baseCost": 200,
      "severityMultiplier": 0.60,
      "finalCost": 224.0
    }
  ]
}
```

---

## 4. Urban Planner Lambda (Optimal Routing)

**ARN**: `arn:aws:lambda:us-east-1:203800220566:function:VigiaStack-IntelligenceWithHazardsUrbanPlannerFunc-*`  
**Handler**: `urban-planner.lambda_handler`  
**Action Group**: `UrbanPlanner`

### Tool 1: `find_optimal_path`

**Purpose**: Find route that avoids hazard-dense areas

**Input**:
```json
{
  "start": {"lat": 42.3601, "lon": -71.0589},
  "end": {"lat": 42.3656, "lon": -71.0596},
  "constraints": {
    "avoidHazardTypes": ["POTHOLE", "DEBRIS"],
    "maxDetourPercent": 20
  }
}
```

**Process**:
```python
# 1. Calculate direct distance (haversine formula)
direct_distance_km = haversine(start, end)

# 2. Generate waypoints (simplified A*)
# Create 6 intermediate points between start and end
waypoints = []
for i in range(8):  # 0=start, 7=end, 1-6=intermediate
    t = i / 7
    lat = start['lat'] + t * (end['lat'] - start['lat'])
    lon = start['lon'] + t * (end['lon'] - start['lon'])
    
    # Generate geohash for waypoint
    geohash = encode_geohash(lat, lon, precision=6)
    
    # Query hazards at this waypoint
    hazards = query_dynamodb(geohash)
    
    # Count hazards matching avoidHazardTypes
    avoid_count = sum(
        1 for h in hazards 
        if h['hazardType'] in constraints['avoidHazardTypes']
    )
    
    waypoints.append({
        'lat': lat,
        'lon': lon,
        'geohash': geohash,
        'hazardCount': avoid_count
    })

# 3. Calculate total distance (with 10% detour for avoidance)
total_distance_km = direct_distance_km * 1.1

# 4. Count total hazards avoided
hazards_avoided = sum(w['hazardCount'] for w in waypoints)

# 5. Calculate detour percentage
detour_percent = ((total_distance_km - direct_distance_km) / direct_distance_km) * 100
```

**Output**:
```json
{
  "path": [
    {"lat": 42.3601, "lon": -71.0589, "geohash": "drt2yzr"},
    {"lat": 42.3610, "lon": -71.0590, "geohash": "drt2yzs"},
    {"lat": 42.3620, "lon": -71.0591, "geohash": "drt2yzt"},
    {"lat": 42.3630, "lon": -71.0592, "geohash": "drt2yzu"},
    {"lat": 42.3640, "lon": -71.0593, "geohash": "drt2yzv"},
    {"lat": 42.3650, "lon": -71.0595, "geohash": "drt2yzw"},
    {"lat": 42.3656, "lon": -71.0596, "geohash": "drt2yzx"}
  ],
  "totalDistanceKm": 0.77,
  "hazardsAvoided": 12,
  "detourPercent": 10.0
}
```

### Tool 2: `calculate_construction_roi`

**Purpose**: Estimate financial return on building new road

**Input**:
```json
{
  "pathData": {
    "distanceKm": 0.77,
    "hazardsAvoided": 12
  },
  "constructionCostPerKm": 1000000
}
```

**Process**:
```python
# 1. Calculate construction cost
construction_cost = pathData['distanceKm'] * constructionCostPerKm
# = 0.77 * 1,000,000 = $770,000

# 2. Estimate annual repair savings
# Assume each hazard costs $500/year to maintain
avg_repair_cost = 500
annual_repair_savings = pathData['hazardsAvoided'] * avg_repair_cost
# = 12 * 500 = $6,000/year

# 3. Calculate break-even point
break_even_years = construction_cost / annual_repair_savings
# = 770,000 / 6,000 = 128.3 years

# 4. Calculate 10-year ROI
total_10_year_savings = annual_repair_savings * 10
roi_10_year = ((total_10_year_savings - construction_cost) / construction_cost) * 100
# = ((60,000 - 770,000) / 770,000) * 100 = -92.2%
```

**Output**:
```json
{
  "constructionCost": 770000,
  "annualRepairSavings": 6000,
  "breakEvenYears": 128.3,
  "roi10Year": -92.2,
  "recommendation": "Not economically viable - consider alternative routes or hazard mitigation"
}
```

**ROI Interpretation**:
- Positive ROI: Construction pays for itself within 10 years
- Negative ROI: Repair costs are lower than construction
- Break-even < 20 years: Good investment
- Break-even > 50 years: Poor investment

---

## How Bedrock Agent Invokes Lambdas

### 1. User Query
```
User: "Analyze network health for geohash drt2yzr"
```

### 2. Agent Reasoning (ReAct Loop)
```
Thought: User wants network health analysis. I should use the analyze_node_connectivity tool.

Action: NetworkIntelligence.analyze_node_connectivity

Action Input:
{
  "geohash": "drt2yzr",
  "radiusKm": 10
}
```

### 3. Lambda Invocation
Bedrock Agent sends this payload to Lambda:
```json
{
  "messageVersion": "1.0",
  "agent": {
    "name": "vigia-auditor-strategist",
    "id": "TAWWC3SQ0L",
    "alias": "TSTALIASID",
    "version": "DRAFT"
  },
  "actionGroup": "NetworkIntelligence",
  "apiPath": "/analyze-node-connectivity",
  "httpMethod": "POST",
  "parameters": [
    {
      "name": "geohash",
      "type": "string",
      "value": "drt2yzr"
    },
    {
      "name": "radiusKm",
      "type": "number",
      "value": "10"
    }
  ],
  "requestBody": {
    "content": {
      "application/json": [
        {
          "name": "geohash",
          "value": "drt2yzr"
        },
        {
          "name": "radiusKm",
          "value": "10"
        }
      ]
    }
  }
}
```

### 4. Lambda Response
Lambda returns:
```json
{
  "messageVersion": "1.0",
  "response": {
    "actionGroup": "NetworkIntelligence",
    "apiPath": "/analyze-node-connectivity",
    "httpMethod": "POST",
    "httpStatusCode": 200,
    "responseBody": {
      "application/json": {
        "body": "{\"activeNodeCount\":15,\"geographicSpread\":{\"coverageAreaKm2\":200,\"uniqueGeohashes\":8},\"healthScore\":74.0,\"lastActivityTimestamp\":\"2026-03-03T23:25:00Z\"}"
      }
    }
  }
}
```

### 5. Agent Final Answer
```
Observation: The network has 15 active nodes covering 200 km² with a health score of 74/100.

Final Answer: The DePIN network in geohash drt2yzr is in GOOD health. There are 15 active contributor nodes spread across 8 unique geohashes, covering approximately 200 km². The health score is 74/100, indicating adequate coverage. Last activity was recorded 2 hours ago, showing the network is actively monitoring this area.
```

---

## Testing Lambdas

### Method 1: Through Bedrock Agent (Recommended)
```bash
# Use the frontend API routes
curl -X POST http://localhost:3000/api/agent/network-analysis \
  -H "Content-Type: application/json" \
  -d '{"geohash":"drt2yzr","radiusKm":10}'
```

### Method 2: Direct Lambda Invocation (For Debugging)
```bash
# Note: Requires proper Bedrock Agent payload format
aws lambda invoke \
  --function-name VigiaStack-IntelligenceWithHazardsNetworkIntellige-BQpjldvWdtKt \
  --payload file://test-payload.json \
  --region us-east-1 \
  response.json
```

### Method 3: Frontend UI (Best for Demo)
1. Open VIGIA dashboard
2. Click "Console" tab → "Network Health"
3. Enter geohash: `drt2yzr`, radius: `10`
4. Click "Analyze Network"
5. View agent response

---

## Cost Breakdown

**Per Lambda Invocation**:
- Lambda execution: $0.0000002 (128MB, 2s avg)
- DynamoDB read: $0.00000025 (1 RCU)
- Bedrock Agent: $0.006 (Nova Lite, ~1K tokens)

**Total per query**: ~$0.006

**Daily estimate** (100 queries):
- Lambda: $0.02
- DynamoDB: $0.025
- Bedrock: $0.60
- **Total**: $0.645/day ($19/month)

---

## Troubleshooting

### Lambda Returns 500 Error
- Check CloudWatch Logs: `/aws/lambda/VigiaStack-IntelligenceWithHazards*`
- Common issues:
  - Missing environment variables (HAZARDS_TABLE_NAME)
  - DynamoDB permission denied
  - Invalid geohash format

### Agent Doesn't Call Lambda
- Verify action group is in PREPARED state
- Check API schema matches Lambda expectations
- Review agent traces in Console tab

### Empty Results
- Verify HazardsTable has data for the queried geohash
- Check timestamp filters (default: last 7 days)
- Try broader geohash prefix (e.g., `drt2y` instead of `drt2yzr`)

---

**Document Owner**: Lead Cloud Architect  
**Last Tested**: 2026-03-04  
**Status**: All Lambdas operational ✅
