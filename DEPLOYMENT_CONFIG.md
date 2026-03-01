# VIGIA Deployment Configuration

## API Endpoints (Deployed: 2026-03-01)

### Main API
```
https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod/
```

### Session API
```
https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod/
```

### Innovation API
```
https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod/
```

## Innovation API Endpoints

- **POST** `/routing-agent/branch` - Recompute routes for scenario branch
- **GET** `/agent-traces/stream` - SSE stream of ReAct traces
- **POST** `/maintenance/report` - Submit maintenance report
- **GET** `/maintenance/queue` - Query maintenance reports
- **GET** `/economic/metrics` - Fetch economic metrics

## DynamoDB Tables

- `VigiaStack-IngestionHazardsTable05BAEAEE-1B0GEE1NV7PU5`
- `VigiaStack-InnovationAgentTracesTable*`
- `VigiaStack-InnovationMaintenanceQueueTable*`
- `VigiaStack-InnovationEconomicMetricsTable*`

## Frontend Configuration

Update `.env.local`:
```bash
NEXT_PUBLIC_API_ENDPOINT=https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_INNOVATION_API_ENDPOINT=https://p4qc9upgsf.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_SESSION_API_ENDPOINT=https://eepqy4yku7.execute-api.us-east-1.amazonaws.com/prod
```

## Status

✅ Infrastructure deployed successfully
✅ All Lambda functions created
✅ All DynamoDB tables created
✅ API Gateway endpoints configured
✅ IAM permissions granted

## Next Steps

1. Update frontend environment variables
2. Test API endpoints
3. Deploy frontend to Amplify/Vercel
