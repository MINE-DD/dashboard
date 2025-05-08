# Cloudflare R2 Integration Guide

This guide provides detailed instructions for integrating Cloudflare R2 storage with the MINE-DD Dashboard application to store and serve Cloud-Optimized GeoTIFF (COG) files.

## Benefits of Using Cloudflare R2

- **Scalability**: Store large amounts of data without worrying about local storage limitations
- **Performance**: Leverage Cloudflare's global CDN for faster data delivery
- **Simplified Deployment**: No need to manage local file storage or volume mounts
- **Cost-Effective**: Pay only for what you use with competitive pricing

## Prerequisites

- A Cloudflare account
- Access to Cloudflare R2 (may require a paid plan)
- COG files prepared for upload

## Setup Steps

### 1. Create a Cloudflare R2 Bucket

1. Log in to your Cloudflare dashboard
2. Navigate to R2 in the sidebar
3. Click "Create bucket"
4. Name your bucket (e.g., `mine-dd-cogs`)
5. Choose a region close to your users

### 2. Upload Your COG Files

Upload your COG files to the R2 bucket, maintaining the same directory structure as expected by the application:

```
cogs/
  01_Pathogens/
    SHIG/
      SHIG_0011_Asym_Pr.tif
      SHIG_0011_Comm_Pr.tif
      ...
  02_Risk_factors/
    Floor/
      Flr_Fin_Pr.tif
      ...
    ...
```

You can upload files using:
- The Cloudflare dashboard
- The Cloudflare API
- Third-party S3-compatible tools (since R2 is S3-compatible)

### 3. Configure Public Access

For the application to access your files directly, you need to make them publicly accessible:

1. In your R2 bucket settings, find the "Public Access" section
2. Enable public access for the bucket
3. Alternatively, you can create a public R2 bucket URL using Cloudflare's "Public Buckets" feature

### 4. Configure CORS (Cross-Origin Resource Sharing)

To allow your application to access the R2 bucket from different domains:

1. In your R2 bucket settings, find the "CORS Configuration" section
2. Add a CORS rule with the following settings:
   ```json
   [
     {
       "AllowedOrigins": ["https://your-app-domain.com", "http://localhost:5173"],
       "AllowedMethods": ["GET"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
3. Replace `https://your-app-domain.com` with your actual application domain

### 5. Update Application Code

You need to modify two files in your application to use the R2 bucket:

#### Update `app/src/lib/components/Map/store/stores.ts`

1. Locate the `baseR2url` variable at the beginning of the `createInitialRasterLayers` function
2. Update it to point to your R2 bucket URL:

```typescript
const baseR2url = 'https://your-bucket-name.r2.cloudflarestorage.com/cogs/';
```

Or if you're using a custom domain:

```typescript
const baseR2url = 'https://r2.your-domain.com/cogs/';
```

#### Update `app/src/lib/components/Map/store/filterRasterMapping.ts`

1. Locate the `baseR2url` variable at the top of the file
2. Update it to match the URL you used in `stores.ts`:

```typescript
const baseR2url = 'https://your-bucket-name.r2.cloudflarestorage.com/cogs/';
```

### 6. Deploy Your Application

1. Commit and push your code changes
2. Deploy your application using your preferred method (Coolify, Vercel, etc.)
3. No need to set the `VITE_TITILER_DATA_PREFIX` environment variable when using R2

## Testing Your Integration

To verify that your R2 integration is working correctly:

1. Open your application in a browser
2. Open the browser's developer tools and go to the Network tab
3. Look for requests to your R2 bucket URL
4. Check that the COG files are being loaded successfully
5. Try toggling different layers on and off to ensure they all work

## Troubleshooting

### Files Not Loading

If your COG files are not loading:

1. Check the browser console for errors
2. Verify that the URLs being requested match your R2 bucket structure
3. Test direct access to a file URL in your browser to ensure it's publicly accessible
4. Check your CORS configuration if you see CORS-related errors

### Performance Issues

If you experience slow loading times:

1. Check the size of your COG files - consider optimizing them further
2. Ensure your R2 bucket is in a region close to your users
3. Consider using Cloudflare's image optimization features if available

### TiTiler Connection Issues

If TiTiler cannot access your R2 files:

1. Ensure TiTiler is configured to allow external URL access
2. Check if your TiTiler instance has internet access
3. Verify that your R2 bucket is publicly accessible

## Advanced Configuration

### Using R2 with Authentication

If you need to secure your R2 bucket with authentication:

1. Create R2 access keys in the Cloudflare dashboard
2. Configure TiTiler with the appropriate environment variables:
   ```
   AWS_ACCESS_KEY_ID=your_r2_access_key
   AWS_SECRET_ACCESS_KEY=your_r2_secret_key
   AWS_REGION=auto
   AWS_ENDPOINT_URL=https://your-account-id.r2.cloudflarestorage.com
   ```
3. Update your application to use the S3 URI scheme instead of direct URLs:
   ```typescript
   const baseR2url = 's3://your-bucket-name/cogs/';
   ```

### Using Cloudflare Workers for Additional Processing

You can use Cloudflare Workers to add additional processing or access control to your R2 files:

1. Create a Worker in the Cloudflare dashboard
2. Write code to handle requests to your R2 bucket
3. Configure your application to use the Worker URL instead of direct R2 URLs

## Cost Considerations

Cloudflare R2 pricing is based on:
- Storage used
- Class A operations (PUT, POST, LIST)
- Class B operations (GET, HEAD)
- Egress beyond the free allowance

Check the [Cloudflare R2 pricing page](https://developers.cloudflare.com/r2/pricing/) for current rates.
