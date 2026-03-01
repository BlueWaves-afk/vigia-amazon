#!/bin/bash

# VIGIA Innovation Features - Deployment Verification
# Verifies all deployed resources are working correctly

set -e

echo "🔍 VIGIA Innovation Features - Deployment Verification"
echo "======================================================="
echo ""

API_BASE="https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod"
PASS=0
FAIL=0

# Function to test endpoint
test_endpoint() {
  local name=$1
  local url=$2
  local method=${3:-GET}
  local data=$4
  
  echo -n "Testing $name... "
  
  if [ "$method" = "POST" ]; then
    http_code=$(curl -s -o /tmp/response.txt -w "%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d "$data")
    body=$(cat /tmp/response.txt)
  else
    http_code=$(curl -s -o /tmp/response.txt -w "%{http_code}" "$url")
    body=$(cat /tmp/response.txt)
  fi
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "✅ PASS (HTTP $http_code)"
    PASS=$((PASS + 1))
    return 0
  else
    echo "❌ FAIL (HTTP $http_code)"
    echo "   Response: $body"
    FAIL=$((FAIL + 1))
    return 1
  fi
}

# Test all endpoints
echo "📡 Testing API Endpoints"
echo "------------------------"

test_endpoint "Routing Agent" "$API_BASE/routing-agent/branch" "POST" '{"branchId":"verify-test","hazards":[]}'
test_endpoint "Economic Metrics" "$API_BASE/economic/metrics?sessionId=verify-test"
test_endpoint "Maintenance Queue" "$API_BASE/maintenance/queue"
test_endpoint "Maintenance Report" "$API_BASE/maintenance/report" "POST" '{"hazardId":"h1","geohash":"7tg3v2k","type":"POTHOLE","severity":3,"reportedBy":"verify","signature":"0xtest"}'

echo ""
echo "🗄️  Testing DynamoDB Tables"
echo "---------------------------"

# Check if tables exist
echo -n "Checking AgentTraces table... "
if aws dynamodb describe-table --table-name VigiaStack-InnovationAgentTracesTable* --region us-east-1 &>/dev/null; then
  echo "✅ EXISTS"
  PASS=$((PASS + 1))
else
  echo "❌ NOT FOUND"
  FAIL=$((FAIL + 1))
fi

echo -n "Checking MaintenanceQueue table... "
if aws dynamodb describe-table --table-name VigiaStack-InnovationMaintenanceQueueTable* --region us-east-1 &>/dev/null; then
  echo "✅ EXISTS"
  PASS=$((PASS + 1))
else
  echo "❌ NOT FOUND"
  FAIL=$((FAIL + 1))
fi

echo -n "Checking EconomicMetrics table... "
if aws dynamodb describe-table --table-name VigiaStack-InnovationEconomicMetricsTable* --region us-east-1 &>/dev/null; then
  echo "✅ EXISTS"
  PASS=$((PASS + 1))
else
  echo "❌ NOT FOUND"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "⚡ Testing Lambda Functions"
echo "---------------------------"

# Check if Lambda functions exist
FUNCTIONS=(
  "VigiaStack-InnovationRoutingAgentBranchFunction"
  "VigiaStack-InnovationAgentTraceStreamerFunction"
  "VigiaStack-InnovationMaintenanceReportHandlerFunction"
  "VigiaStack-InnovationEconomicMetricsQueryFunction"
  "VigiaStack-InnovationMaintenanceQueueQueryFunction"
)

for func in "${FUNCTIONS[@]}"; do
  echo -n "Checking $func... "
  if aws lambda get-function --function-name "$func*" --region us-east-1 &>/dev/null; then
    echo "✅ EXISTS"
    PASS=$((PASS + 1))
  else
    echo "❌ NOT FOUND"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "======================================================="
echo "📊 Verification Results"
echo "======================================================="
echo ""
echo "Total Tests: $((PASS + FAIL))"
echo "Passed: $PASS ✅"
echo "Failed: $FAIL ❌"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 All verification checks passed!"
  echo "✅ VIGIA Innovation Features are fully deployed and operational"
  exit 0
else
  echo "⚠️  Some verification checks failed"
  echo "Please review the errors above"
  exit 1
fi
