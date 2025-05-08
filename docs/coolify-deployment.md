# Coolify Deployment Guide

This guide provides instructions for deploying the MINE-DD Dashboard application using Coolify.

## Prerequisites

- A Coolify instance set up and running
- Access to the Coolify dashboard
- Your project code pushed to a Git repository that Coolify can access

## Deployment Steps

### 1. Create a New Project in Coolify

1. Log in to your Coolify dashboard
2. Create a new project (or use an existing one)
3. Add a new service and select "Docker Compose" as the deployment method
4. Connect to your Git repository and select the branch you want to deploy

### 2. Configure Environment Variables

The application requires several environment variables to be set correctly. In the Coolify interface, navigate to the environment variables section and set the following:

#### Required Environment Variables

- **Database Configuration** (if using a database):
  - `DB_USER`: Database username
  - `DB_PASSWORD`: Database password
  - `DB_HOST`: Database host (use `postgres` if using the included PostgreSQL service)
  - `DB_PORT`: Database port (typically `5432` for PostgreSQL)
  - `DB_NAME`: Database name
  - `DATABASE_URL`: Full database connection string

- **TiTiler Configuration**:
  - `VITE_TITILER_ENDPOINT`: The URL where TiTiler will be accessible (e.g., `https://planeo.ctwhome.com/titiler`)
  - `VITE_TITILER_DATA_PREFIX`: The path prefix for data files in the TiTiler container (default: `/data/`)

- **MapTiler Configuration** (if using MapTiler):
  - `VITE_MAPTILER_KEY`: Your MapTiler API key

### 3. Configure Port Mappings

If you encounter port conflicts (like the one with port 8000), you'll need to modify the port mappings in the Coolify interface:

1. For the TiTiler service, change the port mapping from `8000:8000` to an available port, e.g., `8001:8000` or `8080:8000`
2. Make sure to update the `VITE_TITILER_ENDPOINT` environment variable to match the new port if you're exposing TiTiler directly

### 4. Data Storage Options

You have two options for storing your COG files:

#### Option A: Local Storage with Volume Mounts

If you want to store your COG files locally on the Coolify server:

1. Check that the volume mapping for TiTiler is correctly set up in Coolify
2. If your data files are in a different location or structure than expected, you can adjust the `VITE_TITILER_DATA_PREFIX` environment variable to match

For example, if your COG files are located at `/data/coolify/applications/psgw8wg4s4k4ss4k0cs80ok4/data/cogs` in the container, but the application is looking for them at `/data/01_Pathogens/SHIG/...`, you would set:

```
VITE_TITILER_DATA_PREFIX=/data/coolify/applications/psgw8wg4s4k4ss4k0cs80ok4/data/cogs/
```

#### Option B: Cloud Storage with Cloudflare R2 (Recommended)

Using Cloudflare R2 for storing your COG files offers better scalability and simplifies deployment:

1. Create a Cloudflare R2 bucket and upload your COG files, maintaining the same directory structure
2. Make the bucket publicly accessible or set up appropriate CORS configuration
3. Update the application code to use direct URLs to your R2 bucket:
   - In `app/src/lib/components/Map/store/stores.ts`, set the `baseR2url` variable to your R2 bucket URL
   - In `app/src/lib/components/Map/store/filterRasterMapping.ts`, update the `baseR2url` to match

Example R2 configuration:
```javascript
// In stores.ts and filterRasterMapping.ts
const baseR2url = 'https://your-bucket-name.r2.cloudflarestorage.com/cogs/';
```

With this approach, you don't need to set the `VITE_TITILER_DATA_PREFIX` environment variable, as the application will use the full URLs directly.

### 5. Configure Domain Routing

If you want to serve both the frontend and TiTiler from the same domain, you'll need to configure path-based routing:

1. Set up the frontend to be served at the root path (`/`)
2. Set up TiTiler to be served at a subpath (e.g., `/titiler`)
3. Update the `VITE_TITILER_ENDPOINT` environment variable to point to this subpath

Example configuration:
- Frontend: `https://planeo.ctwhome.com/`
- TiTiler: `https://planeo.ctwhome.com/titiler`
- Environment variable: `VITE_TITILER_ENDPOINT=https://planeo.ctwhome.com/titiler`

### 6. Deploy the Application

Once you've configured all the settings:

1. Save your configuration
2. Click "Deploy" to start the deployment process
3. Monitor the deployment logs for any errors

## Troubleshooting

### Port Conflicts

If you see an error like:
```
Error response from daemon: driver failed programming external connectivity on endpoint titiler-xxx: Bind for 0.0.0.0:8000 failed: port is already allocated
```

This means port 8000 is already in use on the server. Change the port mapping as described in step 3.

### Data File Not Found

If you see errors like:
```
/data/01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif: No such file or directory
```

This indicates that TiTiler cannot find the expected data files. Check:

#### For Local Storage:
1. That your data files are uploaded to the correct location on the server
2. That the volume mounting in Coolify is correct
3. That the `VITE_TITILER_DATA_PREFIX` environment variable is set correctly to point to where your files are actually located

#### For Cloudflare R2:
1. That your files are uploaded to the R2 bucket with the correct paths
2. That the bucket is publicly accessible or has appropriate CORS configuration
3. That the `baseR2url` in the code points to the correct R2 bucket URL
4. That TiTiler can access external URLs (it should by default)

### Routing Issues

If you're seeing TiTiler when you navigate to the root URL instead of your frontend application, check your Traefik routing configuration in Coolify:

1. Ensure that both services aren't configured to handle the same path
2. Set different priorities for the routes if they overlap
3. Consider using path-based routing as described in step 5
