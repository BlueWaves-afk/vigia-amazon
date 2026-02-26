#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VigiaStack } from '../lib/vigia-stack';

const app = new cdk.App();

new VigiaStack(app, 'VigiaStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'VIGIA: Sentient Road Infrastructure System',
});

app.synth();
