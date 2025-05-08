# Production Deployment Troubleshooting

This guide addresses issues specific to production deployments of the MINE-DD Dashboard application.

## CORS Error Between Frontend and TiTiler

If you're seeing a CORS error like:

```
Access to fetch at 'https://planeo-titiler.ctwhome.com/cog/bounds?url=...' from origin 'https://planeo.ctwhome.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

This indicates that your TiTiler service is not configured to allow cross-origin requests from your frontend domain.

### Solution: Configure CORS in TiTiler

1. In your Coolify configuration for the TiTiler service, add or update the `CORS_ORIGINS` environment variable:

```
CORS_ORIGINS=https://planeo.ctwhome.com
```

2. If you need to allow multiple origins, separate them with commas:

```
CORS_ORIGINS=https://planeo.ctwhome.com,http://localhost:5173
```

3. Alternatively, you can use a wildcard to allow all origins (less secure, but easier for testing):

```
CORS_ORIGINS=*
```

4. Restart the TiTiler service after making these changes.

## 502 Bad Gateway Error

If you're seeing a 502 Bad Gateway error when TiTiler tries to access your R2 bucket, this could indicate:

1. Network connectivity issues between TiTiler and R2
2. R2 bucket access permissions
3. Proxy or firewall issues

### Solution 1: Check R2 Bucket Accessibility

1. Make sure your R2 bucket is publicly accessible
2. Try accessing a file directly in your browser:
   `https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_1223_Asym_Pr.tif`
3. If you can't access it directly, check your R2 bucket settings

### Solution 2: Configure R2 CORS Settings

Add a CORS configuration to your R2 bucket that allows access from both your TiTiler domain and your frontend domain:

```json
[
  {
    "AllowedOrigins": [
      "https://planeo.ctwhome.com",
      "https://planeo-titiler.ctwhome.com"
    ],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

### Solution 3: Update TiTiler Configuration

Add these environment variables to your TiTiler service in Coolify:

```
GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
VSI_CACHE=TRUE
GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES
GDAL_HTTP_MULTIPLEX=YES
GDAL_HTTP_VERSION=2
CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif,.TIF,.tiff,.TIFF
GDAL_HTTP_UNSAFESSL=YES
VSI_CACHE_SIZE=1000000000
GDAL_CACHEMAX=1000
```

### Solution 4: Check Proxy Configuration

If you're using a proxy (like Traefik in Coolify):

1. Make sure the proxy is correctly configured to forward requests to TiTiler
2. Check if the proxy has any request size limitations or timeouts
3. Look at the proxy logs for any errors

### Solution 5: Use Authenticated Access to R2

If your R2 bucket requires authentication:

1. Create R2 access keys in the Cloudflare dashboard
2. Add these environment variables to your TiTiler service in Coolify:

```
AWS_ACCESS_KEY_ID=your_r2_access_key
AWS_SECRET_ACCESS_KEY=your_r2_secret_key
AWS_REGION=auto
AWS_ENDPOINT_URL=https://your-account-id.r2.cloudflarestorage.com
```

## Alternative Approach: Proxy R2 Requests Through Backend

If you continue to have issues with direct access to R2 from TiTiler, you can set up a proxy:

1. Create a simple backend service that fetches files from R2
2. Configure this service with the necessary credentials and CORS headers
3. Update your frontend to request files through this proxy instead of directly from R2

Example proxy implementation using Node.js:

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors({
  origin: 'https://planeo.ctwhome.com'
}));

app.get('/proxy-r2/:path(*)', async (req, res) => {
  const path = req.params.path;
  const r2Url = `https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/${path}`;

  try {
    const response = await fetch(r2Url);
    if (!response.ok) {
      return res.status(response.status).send(response.statusText);
    }

    // Forward headers
    response.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });

    // Stream the response
    response.body.pipe(res);
  } catch (error) {
    console.error('Error proxying request:', error);
    res.status(500).send('Error proxying request');
  }
});

app.listen(3000, () => {
  console.log('Proxy server running on port 3000');
});
```

Then update your frontend to use this proxy:

```typescript
// In stores.ts
const baseR2url = 'https://your-proxy-server.com/proxy-r2/';
```

## Checking Logs in Coolify

To diagnose issues further, check the logs in Coolify:

1. Go to your Coolify dashboard
2. Navigate to your application
3. Click on the "Logs" tab
4. Select the TiTiler service
5. Look for any error messages related to CORS or R2 access

## Testing in Production

You can test TiTiler's ability to access R2 directly in production:

```bash
curl -v "https://planeo-titiler.ctwhome.com/cog/info?url=https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_1223_Asym_Pr.tif"
```

This will show you the full request and response, which can help identify the issue.
