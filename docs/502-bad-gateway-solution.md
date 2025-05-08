# Resolving 502 Bad Gateway Error with TiTiler and R2

Based on the curl test results, we've confirmed that TiTiler is returning a 502 Bad Gateway error when trying to access the R2 bucket. This indicates that TiTiler is unable to successfully communicate with the R2 bucket.

## Diagnosis

The 502 Bad Gateway error occurs when TiTiler (acting as a proxy) receives an invalid response from the upstream server (R2 bucket). This could be due to:

1. Network connectivity issues between TiTiler and R2
2. Firewall or proxy restrictions
3. R2 bucket configuration issues
4. TiTiler configuration issues

## Step-by-Step Solutions

### Solution 1: Verify R2 Bucket Public Access

1. Open a browser and try to access a file directly:
   ```
   https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/01_Pathogens/SHIG/SHIG_1223_Asym_Pr.tif
   ```

2. If you get an access denied error or any other error, check your R2 bucket settings in the Cloudflare dashboard:
   - Go to R2 > Your Bucket > Settings
   - Ensure "Public Access" is enabled
   - If using a custom domain, make sure it's properly configured

### Solution 2: Implement a Proxy Server

Since TiTiler is having trouble accessing the R2 bucket directly, a reliable solution is to implement a proxy server that will fetch the files from R2 and serve them to TiTiler.

#### Option A: Simple Express.js Proxy

1. Create a new directory for the proxy server:
   ```bash
   mkdir r2-proxy
   cd r2-proxy
   ```

2. Initialize a new Node.js project:
   ```bash
   npm init -y
   npm install express cors node-fetch@2
   ```

3. Create a server.js file:
   ```javascript
   const express = require('express');
   const cors = require('cors');
   const fetch = require('node-fetch');

   const app = express();
   app.use(cors({
     origin: '*'  // Allow all origins for testing
   }));

   app.get('/r2-proxy/:path(*)', async (req, res) => {
     const path = req.params.path;
     const r2Url = `https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/${path}`;

     console.log(`Proxying request to: ${r2Url}`);

     try {
       const response = await fetch(r2Url);
       if (!response.ok) {
         console.error(`Error from R2: ${response.status} ${response.statusText}`);
         return res.status(response.status).send(response.statusText);
       }

       // Forward content type and other relevant headers
       const contentType = response.headers.get('content-type');
       if (contentType) {
         res.setHeader('Content-Type', contentType);
       }

       // Stream the response
       response.body.pipe(res);
     } catch (error) {
       console.error('Error proxying request:', error);
       res.status(500).send('Error proxying request');
     }
   });

   const PORT = process.env.PORT || 3000;
   app.listen(PORT, () => {
     console.log(`Proxy server running on port ${PORT}`);
   });
   ```

4. Start the proxy server:
   ```bash
   node server.js
   ```

5. Deploy this proxy server to a hosting service (e.g., Vercel, Heroku, or your own server)

6. Update your application to use the proxy URL instead of direct R2 URLs:

   In `app/src/lib/components/Map/store/stores.ts`:
   ```typescript
   const baseR2url = 'https://your-proxy-server.com/r2-proxy/';
   ```

   In `app/src/lib/components/Map/store/filterRasterMapping.ts`:
   ```typescript
   const baseR2url = 'https://your-proxy-server.com/r2-proxy/';
   ```

#### Option B: Cloudflare Worker Proxy

If you're already using Cloudflare, you can create a Worker to proxy requests:

1. Go to the Cloudflare dashboard > Workers & Pages
2. Create a new Worker
3. Use this code:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname.replace('/r2-proxy/', '')
  const r2Url = `https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/${path}`

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  }

  // Handle OPTIONS request for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    })
  }

  try {
    // Fetch from R2
    const response = await fetch(r2Url)

    // Create a new response with CORS headers
    const newResponse = new Response(response.body, response)

    // Add CORS headers to the new response
    Object.keys(corsHeaders).forEach(key => {
      newResponse.headers.set(key, corsHeaders[key])
    })

    return newResponse
  } catch (error) {
    return new Response(`Error proxying to R2: ${error.message}`, { status: 500 })
  }
}
```

4. Deploy the Worker and note the URL (e.g., `https://r2-proxy.your-worker.workers.dev`)

5. Update your application to use the Worker URL:

   ```typescript
   const baseR2url = 'https://r2-proxy.your-worker.workers.dev/r2-proxy/';
   ```

### Solution 3: Configure TiTiler with AWS Credentials

If your R2 bucket requires authentication or if public access is causing issues:

1. Create R2 access keys in the Cloudflare dashboard:
   - Go to R2 > Manage R2 API Tokens
   - Create a new API token with read access to your bucket

2. Add these environment variables to your TiTiler service in Coolify:
   ```
   AWS_ACCESS_KEY_ID=your_r2_access_key
   AWS_SECRET_ACCESS_KEY=your_r2_secret_key
   AWS_REGION=auto
   AWS_ENDPOINT_URL=https://63d6fe7b60cae6fe03c2970c6daf8a9a.r2.cloudflarestorage.com
   ```

3. Update your application to use the S3 URI scheme:
   ```typescript
   const baseR2url = 's3://your-bucket-name/cogs/';
   ```

### Solution 4: Use Local Storage as Fallback

If all else fails, you can download the COG files to your server:

1. Download the COG files to your server
2. Mount them in the TiTiler container
3. Update your application to use local file paths

## Testing the Solutions

After implementing any of these solutions, test it with:

```bash
curl -v "https://planeo-titiler.ctwhome.com/cog/info?url=your-new-url"
```

Replace `your-new-url` with the appropriate URL based on the solution you implemented.

## Recommended Approach

Based on the 502 Bad Gateway error, the most reliable solution is to implement a proxy server (Solution 2). This approach:

1. Bypasses any network or firewall issues between TiTiler and R2
2. Gives you more control over the request/response cycle
3. Allows you to add custom error handling and logging
4. Can be easily deployed to various hosting services

The Cloudflare Worker option is particularly attractive if you're already using Cloudflare, as it will be fast, reliable, and easy to maintain.
