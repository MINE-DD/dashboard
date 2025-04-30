#!/bin/bash
# deploy.sh - Helper script for deploying to Vercel

# Make scripts executable
chmod +x build.sh
chmod +x api/wrapper.sh

# Deploy to Vercel
echo "Deploying to Vercel..."
vercel --prod

echo "Deployment complete. Check the Vercel dashboard for details."