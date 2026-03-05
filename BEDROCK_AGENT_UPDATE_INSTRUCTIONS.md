# Bedrock Agent Schema Update - Add New Functions

## Step 1: Navigate to Bedrock Agent
1. Go to AWS Console → Amazon Bedrock → Agents
2. Select Agent: **TAWWC3SQ0L** (vigia-auditor-strategist)
3. Click **Edit**

## Step 2: Update QueryAndVerify Action Group
1. Find action group: **QueryAndVerify**
2. Click **Edit**
3. Scroll to **API Schema**
4. **REPLACE** the entire schema with this (paths must not have slashes):

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Hazard Verification API",
    "version": "1.0.0"
  },
  "paths": {
    "/query_hazards": {
      "post": {
        "description": "Find hazards at a specific geohash location",
        "operationId": "query_hazards",
        "parameters": [
          {
            "name": "geohash",
            "in": "query",
            "required": true,
            "schema": { "type": "string" },
            "description": "7-character geohash"
          },
          {
            "name": "radiusMeters",
            "in": "query",
            "schema": { "type": "integer" },
            "description": "Search radius in meters"
          },
          {
            "name": "hoursBack",
            "in": "query",
            "schema": { "type": "integer" },
            "description": "How many hours back to search"
          }
        ],
        "responses": {
          "200": {
            "description": "List of hazards",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "hazards": { "type": "array" },
                    "count": { "type": "integer" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/calculate_score": {
      "post": {
        "description": "Calculate verification score for hazards",
        "operationId": "calculate_score",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "similarHazards": {
                    "type": "array",
                    "description": "Array of similar hazards to score"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Verification score",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "verificationScore": { "type": "number" },
                    "breakdown": { "type": "object" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/coordinates_to_geohash": {
      "post": {
        "description": "Convert latitude/longitude coordinates to geohash for querying hazards",
        "operationId": "coordinates_to_geohash",
        "parameters": [
          {
            "name": "latitude",
            "in": "query",
            "required": true,
            "schema": { "type": "number" },
            "description": "Latitude coordinate (-90 to 90)"
          },
          {
            "name": "longitude",
            "in": "query",
            "required": true,
            "schema": { "type": "number" },
            "description": "Longitude coordinate (-180 to 180)"
          }
        ],
        "responses": {
          "200": {
            "description": "Geohash conversion result",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "geohash": { "type": "string" },
                    "latitude": { "type": "number" },
                    "longitude": { "type": "number" },
                    "precision": { "type": "integer" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/scan_all_hazards": {
      "post": {
        "description": "Scan entire hazards database and return highest priority hazards globally with exact locations",
        "operationId": "scan_all_hazards",
        "parameters": [
          {
            "name": "minConfidence",
            "in": "query",
            "schema": { "type": "number" },
            "description": "Minimum confidence threshold (0-1), default 0.7"
          },
          {
            "name": "limit",
            "in": "query",
            "schema": { "type": "integer" },
            "description": "Maximum hazards to scan, default 100"
          }
        ],
        "responses": {
          "200": {
            "description": "High-priority hazards with locations",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "hazards": {
                      "type": "array",
                      "description": "Top 20 hazards sorted by priority with lat/lon"
                    },
                    "totalScanned": { "type": "integer" },
                    "highPriorityCount": { "type": "integer" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Step 3: Update Agent Instructions
1. In the same edit screen, find **Instructions**
2. Replace with the updated instructions from `.kiro/steering/agent_instructions_updated.md`
3. Key additions:
   - `coordinates_to_geohash(latitude, longitude)` - Convert coordinates to geohash
   - `scan_all_hazards(minConfidence, limit)` - Scan entire database for high-priority hazards

## Step 4: Save and Prepare
1. Click **Save and exit**
2. Click **Prepare** (this validates the schema)
3. Wait for status to show **PREPARED**

## Step 5: Create New Version (Optional but Recommended)
1. Click **Create version**
2. Wait for version to be created
3. Go to **Aliases** tab
4. Update alias **TSTALIASID** to point to new version

## Testing

After updating, test with these queries:

### Test 1: Global Scan
```
User: "What are the highest priority hazards globally?"
Expected: Agent calls scan_all_hazards and returns top hazards with locations
```

### Test 2: Coordinate Conversion
```
User: "Show hazards at coordinates 42.36, -71.06"
Expected: Agent calls coordinates_to_geohash, then query_hazards
```

### Test 3: Combined
```
User: "Find critical potholes near 40.71, -74.01"
Expected: Agent converts coordinates, queries hazards, filters by type and priority
```

## Verification

Check CloudWatch Logs for the Lambda to see function calls:
```bash
aws logs tail /aws/lambda/VigiaStack-IntelligenceWithHazardsBedrockRouterFun-gW5JPucnZJJG \
  --follow \
  --region us-east-1
```

Look for:
- `[Router] coordinates_to_geohash called`
- `[Router] scan_all_hazards called`
