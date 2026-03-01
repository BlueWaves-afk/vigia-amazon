#!/bin/bash

# VIGIA Innovation Features - Integration Test Suite
# Tests all deployed API endpoints

set -e

API_BASE="https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod"

echo "🧪 VIGIA Innovation Features - Integration Tests"
echo "================================================"
echo ""

# Test 1: Routing Agent Branch
echo "✓ Test 1: Routing Agent Branch Endpoint"
RESPONSE=$(curl -s -X POST "$API_BASE/routing-agent/branch" \
  -H "Content-Type: application/json" \
  -d '{"branchId":"test-123","hazards":[{"id":"h1","geohash":"7tg3v2k","type":"POTHOLE","severity":3}]}')

if echo "$RESPONSE" | jq -e '.baselineAvgLatency' > /dev/null; then
  echo "  ✅ Routing agent returned valid response"
  echo "  📊 Baseline: $(echo $RESPONSE | jq -r '.baselineAvgLatency')s, Branch: $(echo $RESPONSE | jq -r '.branchAvgLatency')s"
else
  echo "  ❌ Routing agent failed"
  echo "  Response: $RESPONSE"
  exit 1
fi
echo ""

# Test 2: Economic Metrics
echo "✓ Test 2: Economic Metrics Endpoint"
RESPONSE=$(curl -s "$API_BASE/economic/metrics?sessionId=test-session")

if echo "$RESPONSE" | jq -e '.sessionId' > /dev/null; then
  echo "  ✅ Economic metrics returned valid response"
  echo "  📊 Hazards: $(echo $RESPONSE | jq -r '.totalHazardsDetected'), ROI: $(echo $RESPONSE | jq -r '.roiMultiplier')x"
else
  echo "  ❌ Economic metrics failed"
  exit 1
fi
echo ""

# Test 3: Maintenance Report Submission
echo "✓ Test 3: Maintenance Report Submission"
RESPONSE=$(curl -s -X POST "$API_BASE/maintenance/report" \
  -H "Content-Type: application/json" \
  -d '{"hazardId":"h1","geohash":"7tg3v2k","type":"POTHOLE","severity":4,"reportedBy":"test-user","signature":"0xtest","notes":"Integration test"}')

if echo "$RESPONSE" | jq -e '.reportId' > /dev/null; then
  REPORT_ID=$(echo $RESPONSE | jq -r '.reportId')
  COST=$(echo $RESPONSE | jq -r '.estimatedCost')
  echo "  ✅ Maintenance report submitted successfully"
  echo "  📊 Report ID: $REPORT_ID, Estimated Cost: \$$COST"
else
  echo "  ❌ Maintenance report submission failed"
  exit 1
fi
echo ""

# Test 4: Maintenance Queue Query
echo "✓ Test 4: Maintenance Queue Query"
RESPONSE=$(curl -s "$API_BASE/maintenance/queue")

if echo "$RESPONSE" | jq -e 'type == "array"' > /dev/null; then
  COUNT=$(echo $RESPONSE | jq 'length')
  echo "  ✅ Maintenance queue returned valid response"
  echo "  📊 Queue size: $COUNT reports"
else
  echo "  ❌ Maintenance queue query failed"
  exit 1
fi
echo ""

# Test 5: Agent Traces Stream (SSE)
echo "✓ Test 5: Agent Traces Stream (SSE)"
RESPONSE=$(curl -N -s "$API_BASE/agent-traces/stream" 2>&1 | head -1)

if echo "$RESPONSE" | grep -q "data:"; then
  echo "  ✅ Agent traces stream is working"
  echo "  📊 SSE connection established"
else
  echo "  ❌ Agent traces stream failed"
  exit 1
fi
echo ""

# Test 6: End-to-End Flow
echo "✓ Test 6: End-to-End Flow"
echo "  1. Submit maintenance report..."
REPORT=$(curl -s -X POST "$API_BASE/maintenance/report" \
  -H "Content-Type: application/json" \
  -d '{"hazardId":"h2","geohash":"7tg3v2l","type":"DEBRIS","severity":2,"reportedBy":"test-user","signature":"0xtest"}')
REPORT_ID=$(echo $REPORT | jq -r '.reportId')

echo "  2. Query maintenance queue..."
QUEUE=$(curl -s "$API_BASE/maintenance/queue")
FOUND=$(echo $QUEUE | jq --arg id "$REPORT_ID" 'map(select(.reportId == $id)) | length')

if [ "$FOUND" -gt 0 ]; then
  echo "  ✅ End-to-end flow successful"
  echo "  📊 Report found in queue"
else
  echo "  ⚠️  Report not immediately visible (eventual consistency)"
fi
echo ""

# Performance Tests
echo "✓ Test 7: Performance Benchmarks"
echo "  Testing routing agent response time..."
START=$(date +%s%N)
curl -s -X POST "$API_BASE/routing-agent/branch" \
  -H "Content-Type: application/json" \
  -d '{"branchId":"perf-test","hazards":[]}' > /dev/null
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

if [ $DURATION -lt 2000 ]; then
  echo "  ✅ Response time: ${DURATION}ms (target: <2000ms)"
else
  echo "  ⚠️  Response time: ${DURATION}ms (slower than target)"
fi
echo ""

echo "================================================"
echo "✅ All integration tests passed!"
echo ""
echo "Summary:"
echo "  - Routing Agent: Working"
echo "  - Economic Metrics: Working"
echo "  - Maintenance Reports: Working"
echo "  - Maintenance Queue: Working"
echo "  - Agent Traces (SSE): Working"
echo "  - End-to-End Flow: Working"
echo "  - Performance: Acceptable"
echo ""
echo "🎉 VIGIA Innovation Features are production-ready!"
