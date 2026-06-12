# Plan-EO Dashboard Deployment Guide

This guide covers everything you need to run the Plan-EO Dashboard and keep it updated with new data.

There are two roles:

- **IT / Server Admin** — Sets up the server (one time)
- **Researcher** — Uploads new data files when available

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [IT Setup (One Time)](#it-setup-one-time)
3. [Point Data (CSV) Setup](#point-data-csv-setup)
4. [Raster Files (GeoTIFF) Setup](#raster-files-geotiff-setup)
5. [Troubleshooting](#troubleshooting)
6. [Environment Variables](#environment-variables)

---

## How It Works

```
Researcher places CSV or .tif files on the server
         |
         v
Files are served directly by nginx via Docker volume mounts
         |
         v
Dashboard picks up changes on next page refresh (no restart needed)
```

All data files live on the host server and are mounted into the Docker container. Researchers can update data by copying files to the server — no rebuild, no restart required.

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
    volumes:
      - ./point-data:/usr/share/nginx/html/data/01_Points:ro
      - ./raster-data:/usr/share/nginx/html/data/cogs:ro
    restart: unless-stopped
```

> **Note:** The two `volumes` lines mount your local data directories into the container. See [Point Data Setup](#point-data-csv-setup) and [Raster Files Setup](#raster-files-geotiff-setup) below for details.

### Step 4: Set Up Data Directories

Before starting the dashboard, create the data directories on the server:

```bash
cd /path/to/your/dashboard    # same directory as docker-compose.prod.yml
mkdir -p point-data
mkdir -p raster-data
```

Place your data files in these directories:
- **Point data:** See [Point Data (CSV) Setup](#point-data-csv-setup) below
- **Raster files:** See [Raster Files (GeoTIFF) Setup](#raster-files-geotiff-setup) below

### Step 5: Start the Dashboard

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

### Step 6 (Optional): Automatic Updates

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

## Point Data (CSV) Setup

The dashboard displays point data (study locations, prevalence values) from CSV files. These are stored on the host server and mounted into the container as a read-only volume.

### How It Works

```
Host server directory             Container path (read-only)
./point-data/                 →   /usr/share/nginx/html/data/01_Points/
```

The `docker-compose.prod.yml` file maps a host directory to the container path where nginx serves them. By default it uses `./point-data/` next to the compose file, but you can point it anywhere by setting the `POINT_DATA_PATH` environment variable.

### Required Files

Your point data directory must contain:

1. **One or more CSV files** following this naming pattern:
   ```
   YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv
   ```
   Example: `2025-09-01_Plan-EO_Dashboard_point_data.csv`

2. **A `manifest.json` file** that lists the available CSV files:
   ```json
   {
     "files": [
       {
         "fileName": "2025-09-01_Plan-EO_Dashboard_point_data.csv",
         "date": "2025-09-01",
         "displayDate": "September 1, 2025"
       }
     ],
     "lastUpdated": "2025-09-01T00:00:00.000Z",
     "generatedBy": "manual"
   }
   ```
   The dashboard loads the first file in the list (newest first).

### Setup

1. **Copy the default data** from the repository:

   ```bash
   cp -r point-data/* /path/to/your/point-data/
   ```

   Or create the directory and add your own CSV files + manifest.json.

2. **(Optional) Custom path.** Set `POINT_DATA_PATH` if your files live elsewhere:

   ```bash
   export POINT_DATA_PATH=/mnt/storage/point-data
   ```

   Or add it to a `.env` file next to `docker-compose.prod.yml`.

### Updating Point Data

To add new data:
1. Place the new CSV file in the point data directory on the host
2. Update `manifest.json` — add the new file at the **top** of the `files` array
3. Refresh the dashboard in your browser

**No restart needed.** Nginx serves files directly from the volume mount.

### Verify

Visit `http://your-server:8080/data/01_Points/manifest.json` — it should return your manifest JSON.

---

## Raster Files (GeoTIFF) Setup

The dashboard displays raster map layers (pathogen prevalence, risk factors) from GeoTIFF files. These files are **not** baked into the Docker image because they are large. Instead, they are stored on the host server and mounted into the container as a read-only volume.

### How It Works

```
Host server directory             Container path (read-only)
./raster-data/                →   /usr/share/nginx/html/data/cogs/
```

The `docker-compose.prod.yml` file maps a host directory to the container path where nginx serves them. By default it uses `./raster-data/` next to the compose file, but you can point it anywhere by setting the `RASTER_DATA_PATH` environment variable. The dashboard app requests raster files from `/data/cogs/...` and nginx serves them directly from this mount.

### Required Directory Structure

Create a `raster-data/` directory **next to your `docker-compose.prod.yml`** file with the following structure:

```
raster-data/
├── 01_Pathogens/
│   └── SHIG/
│       ├── SHIG_0011_Asym_Pr.tif
│       ├── SHIG_0011_Comm_Pr.tif
│       ├── SHIG_0011_Medi_Pr.tif
│       ├── SHIG_1223_Asym_Pr.tif
│       ├── SHIG_1223_Comm_Pr.tif
│       ├── SHIG_1223_Medi_Pr.tif
│       ├── SHIG_2459_Asym_Pr.tif
│       ├── SHIG_2459_Comm_Pr.tif
│       └── SHIG_2459_Medi_Pr.tif
└── 02_Risk_factors/
    ├── Floor/
    │   ├── Flr_Fin_Pr.tif
    │   └── Flr_Fin_SE.tif
    ├── Roofs/
    │   ├── Rfs_Fin_Pr.tif
    │   └── Rfs_Fin_SE.tif
    ├── Walls/
    │   ├── Wll_Fin_Pr.tif
    │   └── Wll_Fin_SE.tif
    ├── Poultry/
    │   └── Pty_Yes_Pr.tif
    ├── Ruminant/
    │   └── Rum_Yes_Pr.tif
    └── Swine/
        └── Pig_Yes_Pr.tif
```

**File names and folder structure must match exactly.** The dashboard code references these specific paths.

### Configuration File

The `raster-layers.json` file inside your raster data directory tells the dashboard which layers to display and their metadata. A default version is provided in the repository at `raster-data/raster-layers.json` — copy it to your raster data directory alongside your `.tif` files.

For details on editing this file, see the [Researcher Guide](RESEARCHER-GUIDE.md).

### Step-by-Step

1. **Get the raster files.** These `.tif` files should be provided by the research team. They are Cloud Optimized GeoTIFFs (COGs).

2. **Create the directory on the server:**

   ```bash
   cd /path/to/your/dashboard    # same directory as docker-compose.prod.yml
   mkdir -p raster-data/01_Pathogens/SHIG
   mkdir -p raster-data/02_Risk_factors/{Floor,Roofs,Walls,Poultry,Ruminant,Swine}
   ```

3. **Copy the `.tif` files** into the appropriate subdirectories (see structure above).

4. **(Optional) Point to a custom path.** If your raster files live somewhere else (e.g. `/mnt/storage/rasters`), set the `RASTER_DATA_PATH` variable instead of using the default `./raster-data`:

   ```bash
   export RASTER_DATA_PATH=/mnt/storage/rasters
   ```

   Or add it to a `.env` file next to `docker-compose.prod.yml`:

   ```
   RASTER_DATA_PATH=/mnt/storage/rasters
   ```

5. **Start the dashboard:**

   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

6. **Verify** the files are served correctly by visiting:

   ```
   http://your-server:8080/data/cogs/01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif
   ```

   This should start downloading the `.tif` file. If you get a 404 error, check the directory structure and file names.

### Updating Raster Files

To update raster files, simply replace the `.tif` files in the `raster-data/` directory on the host. **No restart is needed** — nginx serves files directly from the mount, so changes take effect immediately.

### Without Raster Files

If you start the dashboard without the `raster-data/` directory, Docker will create an empty directory automatically. The dashboard will still work — point data (CSVs) will display normally — but the raster map layers will fail to load. You can add the raster files at any time and they will start working immediately without a restart.

---

## Managing Data

For detailed instructions on adding, removing, and updating data (both CSV point data and raster layers), see the [Researcher Guide](RESEARCHER-GUIDE.md).

---

## Troubleshooting

### "The dashboard shows but there's no data on the map"

- Check the browser console (F12 > Console tab) for error messages
- Verify `manifest.json` exists in your point data directory and lists the correct CSV file
- Verify the CSV file has the required columns: `EST_ID`, `Pathogen`, `AGE_VAL`, `AGE_LAB`, `SYNDROME_VAL`, `SYNDROME_LAB`, `PREV`, `SE`, `SITE_LAT`, `SITE_LON`, `CASES`, `SAMPLES`
- Visit `http://your-server:8080/data/01_Points/manifest.json` — if you get a 404, the volume mount is not configured correctly

### "Raster layers don't show up"

- Visit `http://your-server:8080/data/cogs/raster-layers.json` — if you get a 404, the raster volume mount is not configured
- Check that `raster-layers.json` is valid JSON
- Check that `.tif` file paths in the JSON match the actual files on disk

### "I updated a file but the dashboard still shows old data"

- Hard-refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check that the file was placed in the correct directory on the host (not inside the container)

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

### Build-Time Variables

These are set at Docker build time. To change them, update the GitHub Actions secrets or rebuild the image.

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_MAPTILER_KEY` | MapTiler API key for base map tiles. Get your own at [maptiler.com](https://www.maptiler.com/) | Shared development key |
| `VITE_R2_POINTS_BASE_URL` | Path where point data CSV files are served from. Do not change. | `/data/01_Points` |
| `VITE_RASTER_BASE_URL` | Path where raster GeoTIFF files are served from. Do not change. | `/data/cogs/` |

### Runtime Variables (docker-compose)

These are set in a `.env` file next to `docker-compose.prod.yml` or as shell environment variables.

| Variable | Description | Default |
|----------|-------------|---------|
| `POINT_DATA_PATH` | Host directory containing CSV point data files + manifest.json | `./point-data` |
| `RASTER_DATA_PATH` | Host directory containing .tif raster files + raster-layers.json | `./raster-data` |

### Setting Your Own MapTiler Key

1. Register at [maptiler.com](https://www.maptiler.com/) and get an API key
2. In your GitHub repo, go to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Name: `VITE_MAPTILER_KEY`, Value: your API key
5. The next build will use your key

---

## Architecture Note

This dashboard is a **fully static website**. It has no backend server, no database, and no server-side processing. The Docker image contains nginx serving pre-built HTML/JS/CSS files. Data files (CSVs and GeoTIFFs) are served from volume mounts. This means:

- It uses minimal resources (~10MB RAM)
- There is nothing to patch or update besides the Docker image itself
- It cannot be "hacked" in the traditional sense (no server-side code to exploit)
- Scaling is not a concern (nginx can handle thousands of concurrent users)
