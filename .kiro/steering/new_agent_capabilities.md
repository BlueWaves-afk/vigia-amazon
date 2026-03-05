# New Agent Capabilities - Global Scan & Coordinate Conversion

## ✅ Added Functions

### 1. `scan_all_hazards(minConfidence, limit)`
**Purpose**: Query entire hazards database and identify highest priority hazards globally

**Input**:
```json
{
  "minConfidence": 0.7,  // Optional, default 0.7
  "limit": 100           // Optional, default 100
}
```

**Output**:
```json
{
  "hazards": [
    {
      "hazardId": "drt2yzr#2026-03-01T10:00:00Z",
      "geohash": "drt2yzr",
      "latitude": 42.3601,
      "longitude": -71.0589,
      "hazardType": "POTHOLE",
      "confidence": 0.92,
      "verificationScore": 85.4,
      "priority": 76.5,
      "timestamp": "2026-03-01T10:00:00Z"
    }
  ],
  "totalScanned": 100,
  "highPriorityCount": 45
}
```

**Priority Formula**:
```
priority = (severity * 0.5) + (verificationScore * 0.3) + (confidence * 100 * 0.2)

Severity:
- ACCIDENT: 100
- POTHOLE: 60
- DEBRIS: 40
- ANIMAL: 20
```

**Features**:
- Returns top 20 hazards sorted by priority
- Includes lat/lon for pinpointing location
- Pre-filtered by confidence threshold
- Scans up to 100 items (configurable)

### 2. `coordinates_to_geohash(latitude, longitude)`
**Purpose**: Convert lat/lon coordinates to geohash for querying

**Input**:
```json
{
  "latitude": 42.3601,
  "longitude": -71.0589
}
```

**Output**:
```json
{
  "geohash": "drt2yzr",
  "latitude": 42.3601,
  "longitude": -71.0589,
  "precision": 7
}
```

**Features**:
- Precision 7 (~150m accuracy)
- No external dependencies (built-in encoder)
- Can be chained with `query_hazards`

## 🤖 Agent Usage Examples

### Example 1: Global Priority Scan
```
User: "What are the highest priority hazards globally?"

Agent workflow:
1. Calls scan_all_hazards(minConfidence=0.7, limit=100)
2. Receives top 20 hazards sorted by priority
3. Responds: "Top 5 critical hazards:
   1. ACCIDENT at (42.36, -71.06) - Priority 95.2
   2. POTHOLE at (40.71, -74.01) - Priority 78.4
   3. POTHOLE at (34.05, -118.24) - Priority 76.1
   ..."
```

### Example 2: Coordinate-Based Query
```
User: "Show hazards at coordinates 42.36, -71.06"

Agent workflow:
1. Calls coordinates_to_geohash(42.36, -71.06)
2. Receives geohash: "drt2yzr"
3. Calls query_hazards(geohash="drt2yzr", radiusMeters=1000)
4. Responds: "Found 15 hazards within 1km of (42.36, -71.06):
   - 8 potholes
   - 5 debris
   - 2 animals"
```

### Example 3: Combined Workflow
```
User: "Find high-priority hazards near 40.71, -74.01"

Agent workflow:
1. Calls coordinates_to_geohash(40.71, -74.01) → "dr5regw"
2. Calls query_hazards(geohash="dr5regw", radiusMeters=5000)
3. Filters results by priority > 70
4. Responds with prioritized list
```

## 📝 Next Steps

### 1. Update Bedrock Agent Configuration (AWS Console)
Navigate to: Amazon Bedrock → Agents → TAWWC3SQ0L → Edit

**Add to Action Group "QueryAndVerify"**:

**API Schema**:
```json
{
  "openapi": "3.0.0",
  "paths": {
    "/scan-all-hazards": {
      "post": {
        "description": "Scan entire hazards database and return high-priority hazards",
        "parameters": [
          {
            "name": "minConfidence",
            "in": "query",
            "schema": { "type": "number" },
            "description": "Minimum confidence threshold (0-1)"
          },
          {
            "name": "limit",
            "in": "query",
            "schema": { "type": "integer" },
            "description": "Maximum hazards to scan"
          }
        ]
      }
    },
    "/coordinates-to-geohash": {
      "post": {
        "description": "Convert latitude/longitude to geohash",
        "parameters": [
          {
            "name": "latitude",
            "in": "query",
            "required": true,
            "schema": { "type": "number" }
          },
          {
            "name": "longitude",
            "in": "query",
            "required": true,
            "schema": { "type": "number" }
          }
        ]
      }
    }
  }
}
```

### 2. Deploy Lambda
```bash
cd packages/infrastructure
npx cdk deploy --all
```

### 3. Test
```bash
# Test coordinate conversion
aws lambda invoke \
  --function-name VigiaStack-BedrockRouterFunction-* \
  --payload '{"apiPath":"/coordinates-to-geohash","parameters":[{"name":"latitude","value":"42.36"},{"name":"longitude","value":"-71.06"}]}' \
  response.json

# Test global scan
aws lambda invoke \
  --function-name VigiaStack-BedrockRouterFunction-* \
  --payload '{"apiPath":"/scan-all-hazards","parameters":[{"name":"minConfidence","value":"0.7"}]}' \
  response.json
```

## ✅ Benefits

1. **Global Visibility**: Agent can now answer "show all critical hazards" without needing specific locations
2. **Coordinate Flexibility**: Users can provide lat/lon instead of geohashes
3. **Priority Intelligence**: Automatic ranking by severity, verification, and confidence
4. **Location Pinpointing**: Returns exact coordinates for each hazard
5. **No External Dependencies**: Built-in geohash encoder (no pip install needed)

## 🎯 Use Cases

- "What are the top 10 most critical hazards globally?"
- "Show hazards at 42.36, -71.06"
- "Find high-priority potholes anywhere in the system"
- "Which hazards need immediate attention?"
- "Convert these coordinates to geohash: 40.71, -74.01"
