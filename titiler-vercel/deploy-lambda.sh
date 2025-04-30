#!/bin/bash
# deploy-lambda.sh - Deploy Titiler to Vercel using the AWS Lambda approach

echo "Deploying Titiler to Vercel using the AWS Lambda approach..."

# Navigate to the lambda directory
cd lambda || { echo "Lambda directory not found!"; exit 1; }

# Deploy to Vercel
echo "Running Vercel deployment..."
vercel --prod

echo "Lambda-based deployment complete. Check the Vercel dashboard for details."