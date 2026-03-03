#!/bin/bash
# VIGIA Platform Depth Upgrade - Deployment Script
# Run this from the repository root

set -e

echo "🚀 VIGIA Platform Depth Upgrade - Deployment"
echo "=============================================="
echo ""

# Step 1: Install dependencies
echo "📦 Step 1: Installing CDK dependencies..."
cd packages/infrastructure
npm install
cd ../..

# Step 2: Synthesize CloudFormation
echo ""
echo "🔨 Step 2: Synthesizing CloudFormation templates..."
cd packages/infrastructure
npx cdk synth > /dev/null
echo "✅ Synthesis complete"

# Step 3: Deploy infrastructure
echo ""
echo "☁️  Step 3: Deploying to AWS..."
echo "This will create:"
echo "  - Step Functions State Machine (UrbanPlannerStateMachine)"
echo "  - Location Service Geofence Collection (VigiaRestrictedZones)"
echo "  - 3 Micro-Lambda Functions"
echo "  - 4 Demo Geofences"
echo ""
read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx cdk deploy --all --require-approval never
    
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Copy the State Machine ARN from CloudFormation outputs"
    echo "2. Update Bedrock Agent 'UrbanPlanner' action group to use State Machine"
    echo "3. Test with: aws stepfunctions start-sync-execution ..."
    echo ""
else
    echo "Deployment cancelled"
    exit 1
fi
