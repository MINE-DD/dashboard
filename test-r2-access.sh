#!/bin/bash

# Test script to check if TiTiler can access Cloudflare R2 bucket

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# R2 bucket URL
R2_URL="https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif"

# TiTiler endpoint
TITILER_ENDPOINT="http://localhost:8010"

echo -e "${YELLOW}Testing direct access to R2 bucket...${NC}"
echo "Trying to access: $R2_URL"

# Test direct access to R2 bucket
if curl -s --head "$R2_URL" | grep "200 OK" > /dev/null; then
  echo -e "${GREEN}✓ Direct access to R2 bucket successful!${NC}"
else
  echo -e "${RED}✗ Could not access R2 bucket directly. Check if the bucket is publicly accessible.${NC}"
  echo "Response headers:"
  curl -s --head "$R2_URL"
  echo ""
fi

echo -e "\n${YELLOW}Testing TiTiler access to R2 bucket...${NC}"
echo "Using TiTiler endpoint: $TITILER_ENDPOINT"

# Test TiTiler access to R2 bucket
ENCODED_URL=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$R2_URL'))")
TITILER_URL="$TITILER_ENDPOINT/cog/info?url=$ENCODED_URL"

echo "Trying to access: $TITILER_URL"

if curl -s "$TITILER_URL" | grep -q "bounds"; then
  echo -e "${GREEN}✓ TiTiler can access the R2 bucket!${NC}"
else
  echo -e "${RED}✗ TiTiler cannot access the R2 bucket.${NC}"
  echo "Response:"
  curl -s "$TITILER_URL"
  echo ""

  echo -e "\n${YELLOW}Checking TiTiler health...${NC}"
  if curl -s "$TITILER_ENDPOINT/healthz" | grep -q "ok"; then
    echo -e "${GREEN}✓ TiTiler is healthy.${NC}"
  else
    echo -e "${RED}✗ TiTiler is not responding correctly.${NC}"
    echo "Response:"
    curl -s "$TITILER_ENDPOINT/healthz"
    echo ""
  fi
fi

echo -e "\n${YELLOW}Recommendations:${NC}"
echo "1. Make sure your R2 bucket is publicly accessible"
echo "2. Check CORS configuration on your R2 bucket"
echo "3. Restart TiTiler after making configuration changes:"
echo "   docker-compose restart titiler"
echo "4. Check TiTiler logs for more details:"
echo "   docker-compose logs titiler"
