# Troubleshooting R2 Connection Issues

This guide will help you diagnose and fix issues with connecting to Cloudflare R2 from TiTiler.

## Common Error: Connection Reset

If you're seeing an error like:
```
GET http://localhost:8010/cog/bounds?url=https%3A%2F%2Fpub-6e8836a….r2.dev%2Fcogs%2F01_Pathogens%2FSHIG%2FSHIG_0011_Asym_Pr.tif net::ERR_CONNECTION_RESET
```

This indicates that the connection to the TiTiler server was reset when trying to fetch the bounds for a COG file from the R2 bucket.

## Diagnostic Steps

### 1. Run the Test Script

We've provided a test script to help diagnose the issue:

```bash
./test-r2-access.sh
```

This script will:
- Test direct access to your R2 bucket
- Test if TiTiler can access your R2 bucket
- Check if TiTiler is healthy

### 2. Check TiTiler Logs

Check the TiTiler logs for any errors:

```bash
docker-compose logs titiler
```

Look for any error messages related to accessing external URLs or SSL certificate issues.

### 3. Verify R2 Bucket Accessibility

Make sure your R2 bucket is publicly accessible:
1. Open a browser and try to access a file directly: `https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif`
2. If you get an access denied error, check your R2 bucket settings

### 4. Check CORS Configuration

Ensure your R2 bucket has the correct CORS configuration:
1. In the Cloudflare dashboard, go to R2 > Your Bucket > Settings > CORS
2. Add a CORS rule that allows access from your application domain

Example CORS configuration:
```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://your-app-domain.com"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

## Solutions

### Solution 1: Update TiTiler Configuration

We've already updated the docker-compose.yml file with additional environment variables to help TiTiler access external URLs:

```yaml
environment:
  - GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
  - VSI_CACHE=TRUE
  - GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES
  - GDAL_HTTP_MULTIPLEX=YES
  - GDAL_HTTP_VERSION=2
  - CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif,.TIF,.tiff,.TIFF
  - GDAL_HTTP_UNSAFESSL=YES
  - VSI_CACHE_SIZE=1000000000
  - GDAL_CACHEMAX=1000
  - PYTHONWARNINGS=ignore
  - WORKERS_PER_CORE=1
  - MAX_WORKERS=1
  - CORS_ORIGINS=*
```

After making these changes, restart TiTiler:

```bash
docker-compose restart titiler
```

### Solution 2: Use Authenticated Access

If your R2 bucket requires authentication, uncomment and set the AWS credentials in docker-compose.yml:

```yaml
- AWS_ACCESS_KEY_ID=your_r2_access_key
- AWS_SECRET_ACCESS_KEY=your_r2_secret_key
- AWS_REGION=auto
- AWS_ENDPOINT_URL=https://account-id.r2.cloudflarestorage.com
```

Replace the values with your actual R2 credentials.

### Solution 3: Use a Proxy

If TiTiler still can't access your R2 bucket directly, you can set up a proxy:

1. Create a simple proxy server that fetches files from R2 and serves them locally
2. Update your application to use the proxy URL instead of direct R2 URLs

### Solution 4: Use Local Storage

As a fallback, you can download the COG files to your local machine and use local storage:

1. Download the COG files to the `data/cogs` directory
2. Update your application to use local file paths instead of R2 URLs
3. Set `VITE_TITILER_DATA_PREFIX=/data/` in your .env file

## Advanced Debugging

### Check Network Connectivity

Make sure your TiTiler container has internet access:

```bash
docker-compose exec titiler curl -v https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif
```

### Test TiTiler with a Different URL

Try accessing a different public URL to see if the issue is specific to R2:

```bash
curl "http://localhost:8010/cog/info?url=https://storage.googleapis.com/open-cogs/stac-examples/20201211_223832_CS2.tif"
```

### Check SSL Certificates

If you're having SSL certificate issues, you can try:

```bash
docker-compose exec titiler curl -k https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif
```

The `-k` flag tells curl to ignore SSL certificate errors.
