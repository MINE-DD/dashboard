# TiTiler Vercel Deployment

This project contains a serverless deployment of TiTiler for Cloud Optimized GeoTIFF (COG) processing.

## Deployment Steps

1. Install the Vercel CLI if you haven't already:
```
npm install -g vercel
```

vercel login

3. Deploy the project:
```
vercel
```

4. For production deployment:
```
vercel --prod
```

## Usage

Once deployed, your TiTiler instance will be available at the provided Vercel URL:

- Health check: `https://your-deployment-url.vercel.app/health`
- COG bounds: `https://your-deployment-url.vercel.app/cog/bounds?url=https://example.com/path/to/your.tif`
- COG info: `https://your-deployment-url.vercel.app/cog/info?url=https://example.com/path/to/your.tif`
- COG tiles: `https://your-deployment-url.vercel.app/cog/tile/z/x/y.png?url=https://example.com/path/to/your.tif`

## CORS Configuration

CORS is currently configured to accept requests from all origins (`*`). For production, you should update the CORS configuration in `api/cog.py` to only allow specific domains.

## Requirements

The project dependencies are listed in `requirements.txt`. Vercel will install these automatically during deployment.

## Environment Variables

The following environment variables are set in `vercel.json`:

- `PYTHONPATH`: Set to "." to ensure Python can find modules
- `GDAL_DISABLE_READDIR_ON_OPEN`: Set to "EMPTY_DIR" for better performance
- `CPL_VSIL_CURL_ALLOWED_EXTENSIONS`: File extensions allowed for virtual file access

## Note on COG Files

TiTiler needs to access your COG files via HTTP/HTTPS URLs. Make sure your COG files are publicly accessible or have appropriate authentication measures.