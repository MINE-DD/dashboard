#!/bin/bash
# deploy-alternate.sh - Alternative deployment approach for Vercel

echo "Preparing for alternate deployment approach..."

# Create a temporary requirements file without the --no-index flag
cat > requirements-alt.txt << EOF
# Core dependencies for Titiler
titiler.core==0.11.7
titiler.application==0.11.7
fastapi==0.95.2
starlette==0.27.0
uvicorn==0.22.0
python-dotenv==1.0.0

# Use pre-built GDAL and rasterio wheels from PyPI
GDAL==3.4.3
rasterio==1.3.7

# Additional dependencies for COG processing
rio-tiler==4.1.10
pydantic<2.0.0
geojson-pydantic==0.5.1
jinja2==3.1.2
python-multipart==0.0.6
simplejson==3.19.1

# AWS S3/R2 support
boto3==1.28.25
botocore==1.31.25
EOF

# Create a temporary vercel.json that uses a different approach
cat > vercel-alt.json << EOF
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.py",
      "use": "@vercel/python",
      "config": {
        "runtime": "python3.9",
        "maxLambdaSize": "50mb",
        "installCommand": "pip install -r requirements-alt.txt"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.py"
    }
  ],
  "env": {
    "PYTHONPATH": ".",
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "VSI_CACHE": "TRUE",
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "GDAL_HTTP_MULTIPLEX": "YES",
    "GDAL_HTTP_VERSION": "2",
    "PYTHONWARNINGS": "ignore",
    "AWS_REGION": "auto",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.TIF,.tiff,.TIFF,.xml,.XML,.aux.xml,.AUX.XML",
    "GDAL_VERSION": "3.4.3",
    "AWS_S3_ENDPOINT": "https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev"
  }
}
EOF

echo "Attempting alternative deployment with standard PyPI packages..."
vercel --prod -f vercel-alt.json

echo "Alternative deployment complete. Check the Vercel dashboard for details."