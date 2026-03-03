#!/bin/bash
# Add demo geofences to VigiaRestrictedZones collection
# Run this after CDK deployment

set -e

COLLECTION_NAME="VigiaRestrictedZones"
REGION="us-east-1"

echo "🗺️  Adding demo geofences to $COLLECTION_NAME..."
echo ""

# Zone 1: Residential (Low Priority)
echo "Adding residential-zone-1..."
aws location put-geofence \
  --collection-name $COLLECTION_NAME \
  --geofence-id residential-zone-1 \
  --geometry 'Polygon=[[[-71.06,42.36],[-71.05,42.36],[-71.05,42.37],[-71.06,42.37],[-71.06,42.36]]]' \
  --region $REGION

# Zone 2: Commercial (Medium Priority)
echo "Adding commercial-zone-1..."
aws location put-geofence \
  --collection-name $COLLECTION_NAME \
  --geofence-id commercial-zone-1 \
  --geometry 'Polygon=[[[-71.07,42.35],[-71.06,42.35],[-71.06,42.36],[-71.07,42.36],[-71.07,42.35]]]' \
  --region $REGION

# Zone 3: Industrial (High Priority)
echo "Adding industrial-zone-1..."
aws location put-geofence \
  --collection-name $COLLECTION_NAME \
  --geofence-id industrial-zone-1 \
  --geometry 'Polygon=[[[-71.08,42.34],[-71.07,42.34],[-71.07,42.35],[-71.08,42.35],[-71.08,42.34]]]' \
  --region $REGION

# Zone 4: Protected (No Construction)
echo "Adding protected-zone-1..."
aws location put-geofence \
  --collection-name $COLLECTION_NAME \
  --geofence-id protected-zone-1 \
  --geometry 'Polygon=[[[-71.09,42.33],[-71.08,42.33],[-71.08,42.34],[-71.09,42.34],[-71.09,42.33]]]' \
  --region $REGION

echo ""
echo "✅ All 4 geofences added successfully!"
echo ""
echo "Verify with:"
echo "aws location list-geofences --collection-name $COLLECTION_NAME --region $REGION"
