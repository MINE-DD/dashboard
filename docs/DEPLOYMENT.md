# Plan-EO Dashboard Deployment Guide

This guide covers everything you need to run the Plan-EO Dashboard and keep it updated with new data.

There are two roles:

- **IT / Server Admin** — Sets up the server (one time)
- **Researcher** — Uploads new data files when available

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [IT Setup (One Time)](#it-setup-one-time)
3. [Researcher: Uploading New Data](#researcher-uploading-new-data)
4. [Troubleshooting](#troubleshooting)
5. [Environment Variables](#environment-variables)

---

## How It Works

```
Researcher uploads CSV file on GitHub
         |
         v
GitHub Action automatically builds a new Docker image
         |
         v
Server pulls the new image and restarts
         |
         v
Dashboard shows the new data
```

The entire process takes about 5 minutes after uploading a file. No terminal access or technical knowledge is needed to update data.

---

## IT Setup (One Time)

### Prerequisites

- A Linux server with [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- A GitHub account that is a member of your organization

### Step 1: Fork the Repository

1. Go to the original repository on GitHub
2. Click the **Fork** button (top right)
3. Select your organization as the destination
4. Keep all default settings and click **Create fork**

### Step 2: Enable GitHub Container Registry

The GitHub Action needs permission to push Docker images.

1. In your forked repo, go to **Settings** > **Actions** > **General**
2. Scroll to **Workflow permissions**
3. Select **Read and write permissions**
4. Click **Save**

### Step 3: Update the Compose File

Edit `docker-compose.prod.yml` and replace `YOUR_ORG` with your GitHub organization name (lowercase):

```yaml
services:
  dashboard:
    image: ghcr.io/your-org-name/plan-eo-dashboard:latest
    ports:
      - "8080:80"
    restart: unless-stopped
```

### Step 4: Start the Dashboard

On your server:

```bash
# Clone your fork
git clone https://github.com/YOUR-ORG/dashboard.git
cd dashboard

# Log in to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Start the dashboard
docker compose -f docker-compose.prod.yml up -d
```

The dashboard is now running at `http://your-server:8080`.

### Step 5 (Optional): Automatic Updates

To have the server automatically pull new images when researchers upload data, uncomment the `watchtower` section in `docker-compose.prod.yml`:

```yaml
  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=300
    restart: unless-stopped
```

Then restart:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Watchtower will check every 5 minutes for new images and automatically update the dashboard.

**Without Watchtower**, you need to manually update after each data upload:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## Researcher: Uploading New Data

### What You Need

- A GitHub account with write access to the repository
- Your CSV data file

### File Naming

Your CSV file **must** be named exactly like this:

```
YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv
```

Examples:
- `2026-04-01_Plan-EO_Dashboard_point_data.csv`
- `2026-03-15_Plan-EO_Dashboard_point_data.csv`

The date should be the date of the data, not the upload date.

### How to Upload

1. Go to your organization's repository on GitHub.com

2. Navigate to the data folder:
   Click **app** > **static** > **data** > **01_Points**

3. Click **Add file** > **Upload files**

4. Drag your CSV file into the upload area (or click "choose your files")

5. At the bottom, you will see a "Commit changes" section:
   - Leave the commit message as-is or write something like "Add March 2026 data"
   - Make sure **"Commit directly to the main branch"** is selected
   - Click **Commit changes**

6. Done. The dashboard will update automatically in about 5 minutes.

### How to Verify

1. Go to the **Actions** tab in your repository
2. You should see a workflow running called "Docker Build & Push"
3. Wait for the green checkmark (this means the build succeeded)
4. If your server has Watchtower enabled, it will pull the new image within 5 minutes
5. If not, ask your IT admin to run the manual update command

---

## Troubleshooting

### "I uploaded a file but the dashboard didn't update"

1. Check the **Actions** tab on GitHub. Is there a failed build (red X)?
   - Click on it to see the error message
   - Most common cause: the CSV file name doesn't match the required pattern
2. If the build succeeded (green checkmark), the server may not have pulled the new image yet
   - If using Watchtower: wait up to 5 minutes
   - If not: ask your IT admin to run the manual update

### "The build failed"

- Check that your CSV file is named correctly: `YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv`
- Check that the file is placed in the correct folder: `app/static/data/01_Points/`
- Check that the CSV file is not corrupted (open it in Excel to verify)

### "The dashboard shows but there's no data on the map"

- Check the browser console (F12 > Console tab) for error messages
- Verify the CSV file has the required columns: `EST_ID`, `Pathogen`, `AGE_VAL`, `AGE_LAB`, `SYNDROME_VAL`, `SYNDROME_LAB`, `PREV`, `SE`, `SITE_LAT`, `SITE_LON`, `CASES`, `SAMPLES`

### "I need to delete an old data file"

1. Navigate to the file on GitHub: **app** > **static** > **data** > **01_Points**
2. Click the file name
3. Click the trash can icon (top right of the file view)
4. Click **Commit changes**

### "How do I check if the container is running?"

On the server:

```bash
docker ps
```

You should see a container named `plan-eo-dashboard` with status "Up".

### "How do I restart the dashboard?"

```bash
docker compose -f docker-compose.prod.yml restart
```

### "How do I see the dashboard logs?"

```bash
docker compose -f docker-compose.prod.yml logs -f
```

---

## Environment Variables

These are set at **Docker build time** (not runtime). To change them, update the GitHub Actions secrets or rebuild the image.

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_MAPTILER_KEY` | MapTiler API key for base map tiles. Get your own at [maptiler.com](https://www.maptiler.com/) | Shared development key |
| `VITE_R2_POINTS_BASE_URL` | Path where data files are served from. Do not change. | `/data/01_Points` |

### Setting Your Own MapTiler Key

1. Register at [maptiler.com](https://www.maptiler.com/) and get an API key
2. In your GitHub repo, go to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Name: `VITE_MAPTILER_KEY`, Value: your API key
5. The next build will use your key

---

## Architecture Note

This dashboard is a **fully static website**. It has no backend server, no database, and no server-side processing. The Docker image contains nginx serving pre-built HTML/JS/CSS files alongside the CSV data files. This means:

- It uses minimal resources (~10MB RAM)
- There is nothing to patch or update besides the Docker image itself
- It cannot be "hacked" in the traditional sense (no server-side code to exploit)
- Scaling is not a concern (nginx can handle thousands of concurrent users)
