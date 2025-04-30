# Titiler Vercel Deployment with Cloudflare R2

This directory contains files necessary to deploy Titiler as Vercel serverless functions to serve your Cloud Optimized GeoTIFF (COG) files from Cloudflare R2.

## Structure

- `api/index.py` - Main serverless function endpoint implementing Titiler functionality
- `requirements.txt` - Python dependencies for Titiler
- `vercel.json` - Vercel configuration file with routes and environment variables

## R2 Configuration

This setup is configured to work with your Cloudflare R2 endpoint and bucket structure:
```
https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/planeo/cogs/
```

Your COGs are organized in:
- `planeo/cogs/01_Pathogens/`
- `planeo/cogs/02_Risk_factors/`

### Setting up your R2 bucket

1. If you haven't already, create a bucket in your Cloudflare R2 account
2. Upload your COG files to the bucket (you can organize them in folders like `cogs333/`)
3. Make sure public access is enabled for the files you want to serve through Titiler

### Required R2 Environment Variables

When deploying to Vercel, you'll need to set these environment variables:

- `AWS_ACCESS_KEY_ID`: Your Cloudflare R2 Access Key ID
- `AWS_SECRET_ACCESS_KEY`: Your Cloudflare R2 Secret Access Key
- `R2_BUCKET`: Default is "planeo" (can be changed if needed)

### Accessing COGs from R2

When your Titiler API is deployed, you can access your COGs using URLs like:

```
https://your-deployment-url.vercel.app/cog/info?url=/vsis3/your-bucket-name/path/to/file.tif
```

The `/vsis3/` prefix tells GDAL to use the S3 virtual file system, which will use the provided AWS credentials to access your R2 bucket.

## Usage Examples

Once deployed, your Titiler API will be available at your Vercel deployment URL. Here are some example usage patterns:

### Special endpoints for your R2 structure

```
# Access pathogens files
https://your-vercel-app.vercel.app/pathogens/your-file.tif?request_path=info

# Access risk factor files
https://your-vercel-app.vercel.app/risk-factors/your-file.tif?request_path=info

# Access any file in the planeo bucket
https://your-vercel-app.vercel.app/planeo/cogs/01_Pathogens/your-file.tif?request_path=info
```

### For tile requests

```
# Get a tile from a pathogen file
https://your-vercel-app.vercel.app/pathogens/your-file.tif?request_path=tile&z=5&x=16&y=10

# Get a tile from a risk factor file
https://your-vercel-app.vercel.app/risk-factors/your-file.tif?request_path=tile&z=5&x=16&y=10
```

### Standard Titiler endpoints

```
# Get info about a pathogen COG file
https://your-vercel-app.vercel.app/cog/info?url=/vsis3/planeo/cogs/01_Pathogens/your-file.tif

# Get a tile from a risk factor file
https://your-vercel-app.vercel.app/cog/tile/5/16/10.png?url=/vsis3/planeo/cogs/02_Risk_factors/your-file.tif
```

## Deployment Steps

1. Install the Vercel CLI:
   ```
   npm install -g vercel
   ```

2. Log in to Vercel:
   ```
   vercel login
   ```

3. Link your project:
   ```
   cd titiler-vercel
   vercel link
   ```

4. Set up environment variables for R2 access:
   ```
   vercel env add AWS_ACCESS_KEY_ID
   vercel env add AWS_SECRET_ACCESS_KEY
   vercel env add R2_BUCKET
   ```

5. Deploy:
   ```
   vercel --prod
   ```

## Usage

Once deployed, you can access the Titiler API at your Vercel deployment URL:

- Swagger UI: `https://your-deployment-url.vercel.app/docs`
- Health check: `https://your-deployment-url.vercel.app/healthz`
- COG endpoints: `https://your-deployment-url.vercel.app/cog/...`
- Mosaic endpoints: `https://your-deployment-url.vercel.app/mosaicjson/...`

## Environment Variables

The following environment variables are pre-configured in `vercel.json`:

- Standard GDAL optimization variables
- `AWS_REGION=auto` (required for R2)
- `AWS_S3_ENDPOINT=https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev`

You'll need to add these variables separately in the Vercel dashboard or CLI:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `R2_BUCKET` (optional, for the /direct/ endpoint)

## Differences from Docker Setup

The main difference between this Vercel deployment and your Docker setup is:

1. **File Access:** The Docker setup mounts your local COG files directly, while the Vercel functions will access files via Cloudflare R2.

2. **Scaling:** Vercel serverless functions will auto-scale with demand, unlike the fixed container configuration in Docker.

3. **Cold Start:** Serverless functions may experience cold starts, which could affect initial response times.