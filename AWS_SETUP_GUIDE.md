# AWS Setup Guide for VIGIA

## Step 1: Create AWS Account (10 minutes)

### 1.1 Sign Up
1. Go to https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Enter email address (use your personal/work email)
4. Choose account name: `vigia-dev` or your name
5. Enter contact information
6. Add credit/debit card (required, but won't be charged if you stay in Free Tier)
7. Verify phone number (SMS verification)
8. Choose "Basic Support - Free"
9. Wait for account activation (usually instant)

### 1.2 Sign In
1. Go to https://console.aws.amazon.com/
2. Sign in with your email and password
3. You'll see the AWS Management Console

---

## Step 2: Create IAM User (5 minutes)

**Why?** Don't use root account for development. Create an IAM user with specific permissions.

### 2.1 Navigate to IAM
1. In AWS Console, search for "IAM" in the top search bar
2. Click "IAM" (Identity and Access Management)

### 2.2 Create User
1. Click "Users" in left sidebar
2. Click "Create user" button
3. User name: `vigia-developer`
4. Click "Next"

### 2.3 Set Permissions
1. Select "Attach policies directly"
2. Search and check these policies:
   - ✅ `AdministratorAccess` (easiest for development)
   
   **OR** for more security, select these individually:
   - ✅ `AWSLambda_FullAccess`
   - ✅ `AmazonDynamoDBFullAccess`
   - ✅ `AmazonAPIGatewayAdministrator`
   - ✅ `SecretsManagerReadWrite`
   - ✅ `AmazonBedrockFullAccess`
   - ✅ `CloudFormationFullAccess`
   - ✅ `IAMFullAccess`

3. Click "Next"
4. Click "Create user"

### 2.4 Create Access Keys
1. Click on the user you just created (`vigia-developer`)
2. Click "Security credentials" tab
3. Scroll down to "Access keys"
4. Click "Create access key"
5. Select "Command Line Interface (CLI)"
6. Check "I understand..." checkbox
7. Click "Next"
8. Description: `VIGIA Development`
9. Click "Create access key"

### 2.5 **IMPORTANT: Save Your Keys**
You'll see:
```
Access key ID: AKIAIOSFODNN7EXAMPLE
Secret access key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

**⚠️ SAVE THESE NOW! You can't see the secret key again!**

Options to save:
- Click "Download .csv file" (recommended)
- Copy to a password manager
- Write them down temporarily

---

## Step 3: Install AWS CLI (5 minutes)

### 3.1 Check if Already Installed
```bash
aws --version
```

If you see a version number, skip to Step 4.

### 3.2 Install AWS CLI (macOS)
```bash
# Using Homebrew (recommended)
brew install awscli

# OR download installer
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
```

### 3.3 Verify Installation
```bash
aws --version
# Should show: aws-cli/2.x.x ...
```

---

## Step 4: Configure AWS CLI (2 minutes)

### 4.1 Run Configuration
```bash
aws configure
```

### 4.2 Enter Your Credentials
```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE  # Paste your access key
AWS Secret Access Key [None]: wJalrXUtnFEMI/...  # Paste your secret key
Default region name [None]: us-east-1            # Or your preferred region
Default output format [None]: json               # Press Enter
```

**Region Options**:
- `us-east-1` (N. Virginia) - Recommended, has all services
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)
- `ap-southeast-1` (Singapore)

### 4.3 Verify Configuration
```bash
aws sts get-caller-identity
```

**Expected output**:
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/vigia-developer"
}
```

If you see this, **AWS CLI is configured correctly!** ✅

---

## Step 5: Install Docker Desktop (10 minutes)

### 5.1 Download Docker
1. Go to https://www.docker.com/products/docker-desktop/
2. Click "Download for Mac"
3. Choose your Mac chip:
   - **Apple Silicon (M1/M2/M3)**: Download "Mac with Apple chip"
   - **Intel**: Download "Mac with Intel chip"

### 5.2 Install Docker
1. Open the downloaded `.dmg` file
2. Drag Docker icon to Applications folder
3. Open Docker from Applications
4. Accept terms and conditions
5. Wait for Docker to start (whale icon in menu bar)

### 5.3 Verify Docker
```bash
docker --version
# Should show: Docker version 24.x.x or higher
```

**⚠️ Make sure Docker Desktop is running** (whale icon in menu bar should be active)

---

## Step 6: Bootstrap AWS CDK (5 minutes)

### 6.1 Install AWS CDK
```bash
npm install -g aws-cdk
```

### 6.2 Verify CDK Installation
```bash
cdk --version
# Should show: 2.x.x
```

### 6.3 Bootstrap CDK in Your AWS Account
```bash
cd /Users/tommathew/Documents/Github\ Repositories/vigia-amazon/packages/infrastructure

cdk bootstrap
```

**Expected output**:
```
⏳ Bootstrapping environment aws://123456789012/us-east-1...
✅ Environment aws://123456789012/us-east-1 bootstrapped
```

This creates a CloudFormation stack called `CDKToolkit` in your AWS account.

---

## Step 7: Deploy VIGIA Infrastructure (15 minutes)

### 7.1 Synthesize CloudFormation Template (Test)
```bash
cd /Users/tommathew/Documents/Github\ Repositories/vigia-amazon/packages/infrastructure

cdk synth
```

**Expected**: Should generate CloudFormation template without errors.

### 7.2 Deploy to AWS
```bash
cdk deploy
```

**What happens**:
1. CDK shows you what will be created
2. You'll see a list of resources (DynamoDB tables, Lambdas, API Gateway, etc.)
3. Prompt: `Do you wish to deploy these changes (y/n)?`
4. Type `y` and press Enter

**Deployment takes 5-10 minutes**. You'll see:
```
✨ Synthesis time: 5.2s
VigiaStack: deploying...
VigiaStack: creating CloudFormation changeset...
 0/25 | 12:34:56 | CREATE_IN_PROGRESS   | AWS::DynamoDB::Table | HazardsTable
 1/25 | 12:35:12 | CREATE_COMPLETE      | AWS::DynamoDB::Table | HazardsTable
...
✅ VigiaStack

Outputs:
VigiaStack.ApiEndpoint = https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
VigiaStack.HazardsTableName = VigiaStack-IngestionHazardsTable12345ABC

Stack ARN:
arn:aws:cloudformation:us-east-1:123456789012:stack/VigiaStack/...
```

### 7.3 **SAVE THE API ENDPOINT!**
Copy the `ApiEndpoint` URL from the output:
```
https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

---

## Step 8: Configure Frontend (2 minutes)

### 8.1 Create Environment File
```bash
cd /Users/tommathew/Documents/Github\ Repositories/vigia-amazon/packages/frontend

cp .env.local.example .env.local
```

### 8.2 Edit .env.local
```bash
nano .env.local
# OR
code .env.local
```

Add your API endpoint:
```
NEXT_PUBLIC_API_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

Save and close (Ctrl+X, then Y, then Enter if using nano).

---

## Step 9: Test End-to-End (5 minutes)

### 9.1 Start Frontend
```bash
cd /Users/tommathew/Documents/Github\ Repositories/vigia-amazon/packages/frontend

npm run dev
```

Open http://localhost:3000

### 9.2 Upload Private Key
1. Click "Upload Private Key"
2. Navigate to: `/Users/tommathew/Documents/Github Repositories/vigia-amazon/`
3. Select `private-key.pem`
4. Wait for "✓ Key loaded"

### 9.3 Upload Video
1. Click "Upload Video"
2. Select any dashcam video (MP4, WebM, etc.)
3. Click "Start Detection"

### 9.4 Watch Console
Open browser console (Cmd+Option+J in Chrome):
```
[Worker] ONNX model loaded successfully
[Worker] Pothole detected: 0.87 (45ms)
[Batch] Sending 2 telemetry items
```

### 9.5 Verify in AWS
```bash
# Check DynamoDB for hazard records
aws dynamodb scan \
  --table-name VigiaStack-IngestionHazardsTable12345ABC \
  --max-items 5
```

**Expected**: You should see hazard records with status "pending"

---

## 🎉 Success Checklist

- [x] AWS account created
- [x] IAM user created with access keys
- [x] AWS CLI installed and configured
- [x] Docker Desktop installed and running
- [x] AWS CDK installed and bootstrapped
- [x] VIGIA infrastructure deployed
- [x] API Gateway endpoint saved
- [x] Frontend configured with API URL
- [x] Video upload works
- [x] Pothole detection works
- [x] Telemetry reaches DynamoDB

---

## 📝 What You Need to Provide Me

After completing the setup, share these with me:

1. **API Gateway Endpoint** (from Step 7.3)
   ```
   https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
   ```

2. **AWS Region** (from Step 4.2)
   ```
   us-east-1
   ```

3. **DynamoDB Table Name** (from Step 7.3)
   ```
   VigiaStack-IngestionHazardsTable12345ABC
   ```

4. **Any errors** you encounter during deployment

---

## 🐛 Common Issues

### "Access Denied" during deployment
**Solution**: Make sure your IAM user has `AdministratorAccess` or all required policies.

### "Docker daemon not running"
**Solution**: Open Docker Desktop and wait for it to start (whale icon in menu bar).

### "CDK bootstrap failed"
**Solution**: 
```bash
aws sts get-caller-identity  # Verify AWS CLI is configured
cdk bootstrap --verbose       # Try with verbose output
```

### "Region not supported"
**Solution**: Use `us-east-1` (N. Virginia) - it has all services including Bedrock.

### "Rate limit exceeded"
**Solution**: Wait a few minutes and try again. AWS has rate limits for new accounts.

---

## 💰 Cost Monitoring

### Check Current Costs
```bash
aws ce get-cost-and-usage \
  --time-period Start=$(date -v-1d +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost
```

### Set Up Billing Alert
1. Go to AWS Console → Billing Dashboard
2. Click "Budgets" in left sidebar
3. Click "Create budget"
4. Choose "Zero spend budget" (alerts if you spend anything)
5. Enter email for notifications

---

## 🚀 Next Steps After Deployment

1. **Test the system** with a dashcam video
2. **Set up Bedrock Agent** (manual, see WHATS_LEFT.md)
3. **Create Python Lambda functions** for action groups
4. **Add visualization** with Amazon Location Service

---

**Estimated Total Time**: 45-60 minutes  
**Cost**: $0 (everything in Free Tier for now)

Let me know when you've completed the setup and I'll help with the next steps!
