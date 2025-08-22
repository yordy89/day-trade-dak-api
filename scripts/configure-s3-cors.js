#!/usr/bin/env node

const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function configureCORS() {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  
  if (!bucketName) {
    console.error('❌ AWS_S3_BUCKET_NAME not found in environment variables');
    process.exit(1);
  }

  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    // Read CORS configuration
    const corsConfigPath = path.join(__dirname, '..', 's3-cors-config.json');
    const corsRules = JSON.parse(fs.readFileSync(corsConfigPath, 'utf8'));

    // Apply CORS configuration
    const putCorsCommand = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: corsRules.map(rule => ({
          AllowedHeaders: rule.AllowedHeaders,
          AllowedMethods: rule.AllowedMethods,
          AllowedOrigins: rule.AllowedOrigins,
          ExposeHeaders: rule.ExposeHeaders,
          MaxAgeSeconds: rule.MaxAgeSeconds,
        })),
      },
    });

    await s3Client.send(putCorsCommand);
    console.log(`✅ CORS configuration applied successfully to bucket: ${bucketName}`);

    // Verify the configuration
    const getCorsCommand = new GetBucketCorsCommand({
      Bucket: bucketName,
    });

    const response = await s3Client.send(getCorsCommand);
    console.log('\n📋 Current CORS Configuration:');
    console.log(JSON.stringify(response.CORSRules, null, 2));

  } catch (error) {
    console.error('❌ Error configuring CORS:', error.message);
    
    if (error.name === 'NoSuchBucket') {
      console.error(`Bucket "${bucketName}" does not exist`);
    } else if (error.name === 'AccessDenied') {
      console.error('Access denied. Check your AWS credentials and permissions');
    }
    
    process.exit(1);
  }
}

// Run the script
configureCORS().catch(console.error);