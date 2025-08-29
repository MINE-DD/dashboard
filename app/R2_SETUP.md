# R2 Data Integration Setup

This document explains how to configure the automatic R2 data file detection for the MINE-DD Dashboard.

## Overview

The application can automatically detect and use the latest data files from Cloudflare R2 storage. This happens at **build time**, not runtime, making it efficient for static hosting on GitHub Pages.

## How It Works

1. **Build Time**: When you run `bun run build`, a script fetches the list of available CSV files from your R2 bucket
2. **Manifest Generation**: The script creates a `data-manifest.json` file with the list of available data files
3. **Runtime**: The app reads this manifest to know which data files are available
4. **Fallback**: If R2 credentials aren't available, it uses the date specified in `VITE_LATEST_DATA_DATE`

## Setup for Local Development

**It's fully automated!** The build script automatically detects the latest data files from your public R2 bucket:

1. When you run `bun run build` or `bun run dev`, the prebuild script runs automatically
2. It checks your public R2 URL for available data files
3. Updates the manifest with the latest files
4. No manual configuration needed!

### Optional: R2 API Credentials
If you want to use the R2 API (for private buckets or faster detection):

```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=mine-dd-data
```

## Setup for GitHub Actions Deployment

1. Go to your GitHub repository settings
2. Navigate to Secrets and Variables > Actions
3. Add the following **secrets**:
   - `R2_ACCOUNT_ID`: Your Cloudflare account ID
   - `R2_ACCESS_KEY_ID`: Your R2 access key ID
   - `R2_SECRET_ACCESS_KEY`: Your R2 secret access key
   - `R2_BUCKET_NAME`: Your R2 bucket name (e.g., `mine-dd-data`)

4. Add the following **variables** (not secrets):
   - `VITE_R2_POINTS_BASE_URL`: The public URL for your R2 bucket
   - `VITE_MAPTILER_KEY`: Your MapTiler API key

## Getting R2 Credentials

1. Log in to your Cloudflare dashboard
2. Go to R2 > Overview
3. Click "Manage R2 API Tokens"
4. Create a new API token with:
   - Permissions: Object Read (minimum)
   - Specify bucket: Select your data bucket
5. Save the credentials securely

## Data File Naming Convention

Data files must follow this naming pattern:
```
YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv
```

Example: `2025-08-25_Plan-EO_Dashboard_point_data.csv`

## Updating Data

When you upload new data to R2:

1. **Automatic**: The next GitHub Actions build will automatically detect and use the latest file
2. **Manual**: Update `VITE_LATEST_DATA_DATE` in `.env` if not using R2 credentials

## Testing

To test the R2 manifest generation locally:
```bash
bun run scripts/fetch-r2-manifest.ts
```

Check the generated manifest:
```bash
cat static/data-manifest.json
```

## Troubleshooting

- **No credentials**: The build will use the fallback date from `VITE_LATEST_DATA_DATE`
- **Invalid credentials**: Check the build logs in GitHub Actions
- **File not found**: Ensure your data files follow the naming convention
- **CORS issues**: Make sure your R2 bucket has public access enabled