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
NEXT_PUBLIC_API_URL=https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_BEDROCK_AGENT_ID=TAWWC3SQ0L
NEXT_PUBLIC_BEDROCK_AGENT_ALIAS_ID=TSTALIASID
NEXT_PUBLIC_MAP_NAME=VigiaMap
NEXT_PUBLIC_LOCATION_API_KEY=v1.public.eyJqdGkiOiJkN2QwYTlmOS1lYjZkLTRjOTQtYTIxNC05N2Q2ZmJlOTU3MmMifWTCojpUiFP_lawxlNoI9l7TZp5N9rX7znWRu9ptYEAkBQNNFqVl_lL3VNDOEvA8D5pF8-PnfIjjc5I4xsjPE9CO3_ccfkdpNjtEbMqrsM9OAFB5C9HwmpEp6Hw-ccRCpAzDJ_taVGlKnLfkKjBdh7FaVVnC7VZNPLZSiphvhMPeDS7mP3_yoSytXj3DW38K8OT8-Y54JTJcHkSkVesoHtbQ7pp8GADXajxhK-rNJnH0774H36UNT7L-UZuZn5tj2DB-LpBvTvwEPbkrsycs7Nry6nEfEMpnbO92FCnVlfo2lCWYWGNUWd05RrK517RX8ZCWHpzQUZYCoezYAdC5mww.ZWU0ZWIzMTktMWRhNi00Mzg0LTllMzYtNzlmMDU3MjRmYTkx
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
