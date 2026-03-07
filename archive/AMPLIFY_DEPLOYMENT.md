# AWS Amplify Deployment Guide

## Files Created

1. **amplify.yml** - Amplify build configuration (root directory)

## Deployment Steps

### 1. Push Changes to GitHub
```bash
git add amplify.yml packages/frontend/app/components/Sidebar.tsx
git commit -m "Add Amplify deployment configuration"
git push
```

### 2. Configure Environment Variables in Amplify Console

Go to your Amplify app → Environment variables and add:

```
NEXT_PUBLIC_API_URL=<YOUR_API_GATEWAY_URL>
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_BEDROCK_AGENT_ID=<YOUR_AGENT_ID>
NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID=<YOUR_ALIAS_ID>
NEXT_PUBLIC_MAP_NAME=VigiaMap
NEXT_PUBLIC_LOCATION_API_KEY=<YOUR_LOCATION_API_KEY>
```

### 3. Trigger Deployment

The build will automatically trigger when you push to GitHub. Amplify will:
1. Install dependencies in `packages/frontend`
2. Run `npm run build`
3. Deploy the `.next` directory

### 4. Build Configuration

The `amplify.yml` file configures:
- **Build directory**: `packages/frontend`
- **Output directory**: `packages/frontend/.next`
- **Cache**: `node_modules` for faster builds

## Troubleshooting

If build fails:
1. Check environment variables are set correctly
2. Verify the branch is connected in Amplify
3. Check build logs in Amplify Console

## Local Testing

Test the production build locally:
```bash
cd packages/frontend
npm run build
npm start
```

Visit http://localhost:3000 to verify.
