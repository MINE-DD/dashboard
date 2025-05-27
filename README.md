# MINE-DD Dashboard

## Project Overview

This project is the dashboard component for MINE-DD, an initiative by the Netherlands eScience Center. Its primary purpose is to serve and visualize data on an interactive map.

## Problem Solved

The dashboard provides an interactive interface for visualizing geographical data relevant to the MINE-DD project.

## Tech Stack

![](./tech.excalidraw.png)

The application is built using the following technologies:

*   **Frontend:**
    *   SvelteKit (using Svelte 5 runes)
    *   TypeScript
    *   Tailwind CSS
    *   DaisyUI
    *   Maplibre-GL (for the interactive map)
*   **Backend/Runtime:**
    *   Bun.js
*   **Database:**
    *   PostgreSQL
*   **Deployment & Infrastructure:**
    *   Docker & Docker Compose
    *   Vercel (for frontend hosting and cloud functions)
    *   TiTiler (for serving Cloud-Optimized GeoTIFFs)

## Key Features & Functionalities

*   **Interactive Map:** Powered by Maplibre-GL for displaying geographical data.
*   **TiTiler Integration:**
    *   Serves Cloud-Optimized GeoTIFF (COG) raster data efficiently.
    *   Runs as a dedicated Docker service (`docker-compose.yml`).
    *   Supports multiple data sources:
        *   Local files in the `data/cogs` directory (using `VITE_TITILER_DATA_PREFIX` environment variable)
        *   Cloud storage via Cloudflare R2 (using direct URLs)
    *   Displays COG data using an image-based approach compatible across platforms, including Apple Silicon.
    *   Allows users to toggle the visibility and adjust the opacity of raster layers.
    *   Supports loading remote COG layers directly via URL input in the sidebar (proxied through TiTiler).
    *   Uses nearest-neighbor resampling to maintain sharp edges in raster data during zoom operations.
    *   Automatically displays relevant raster layers based on filter selections (pathogen, age group, syndrome).
    *   Provides a global opacity slider to adjust all visible raster layers simultaneously.
    *   Ensures point data (dots) always appear on top of raster layers for better visibility through a comprehensive approach that handles dynamic layer additions.

## Development Setup

### Prerequisites

- **Docker Desktop** must be installed and running on your system
  - Download from [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
  - Ensure Docker is running before proceeding

### Quick Start

```bash
# Clone the repository
git clone https://github.com/escience/mine-dd.git
cd mine-dd/dashboard

# Start all services (frontend + chat backend)
docker compose up -d
```

**🚀 Open your browser and visit [http://localhost:4000](http://localhost:4000)**

### Services Overview

The development environment includes:

- **Frontend Dashboard**: Available at [http://localhost:4000](http://localhost:4000)
- **AI Chat Backend**: Available at [http://localhost:4040](http://localhost:4040)
  - API documentation: [http://localhost:4040/docs](http://localhost:4040/docs)

### Useful Commands

```bash
# View service logs
docker compose logs -f

# View logs for specific service
docker compose logs -f frontend
docker compose logs -f chat-backend

# Stop all services
docker compose down

# Rebuild and restart services
docker compose up -d --build

# Stop and remove all containers, networks, and volumes
docker compose down -v
```

## Processing Raster Maps

The repository includes a script for processing raster maps into Cloud Optimized GeoTIFFs (COGs) suitable for web visualization.

### Prerequisites

- GDAL must be installed on your system
  ```bash
  # Install GDAL on macOS using Homebrew
  brew install gdal

  # Install GDAL on Ubuntu/Debian
  sudo apt-get install gdal-bin python3-gdal
  ```

### Using the Script

1. Place your raster files (.tif) in the `data/02_Rasters` directory. You can organize them in subdirectories if desired.

2. Run the conversion script:
   ```bash
   bash process_rasters.sh
   ```

3. The script will:
   - Reproject all rasters to EPSG:4326 (WGS 84) using bilinear resampling
   - Convert them to Cloud Optimized GeoTIFFs with Google Maps Compatible tiling
   - Apply DEFLATE compression to reduce file size
   - Preserve the original directory structure in the output
   - Copy any associated metadata files

4. Processed files will be available in the `data/cogs` directory, maintaining the same subdirectory structure as the input.

### Customization

The script can be modified to adjust:
- Input/output directories by changing the `INPUT_DIR` and `OUTPUT_DIR` variables
- Coordinate reference system by changing the `-t_srs` parameter in the `gdalwarp` command
- Resampling method by changing the `-r` parameter (options include: nearest, bilinear, cubic, cubicspline)
- Compression settings in the `gdal_translate` command

## Next Steps

* Implement thorough testing of the filter-to-raster mapping functionality to ensure it works correctly in all scenarios.
* Optimize performance when dealing with many raster layers simultaneously.
* Add visual feedback when raster layers are loading or when filters are applied.
* Expand the filter-to-raster mapping to include additional pathogens and data categories.
* Improve documentation of the raster layer system for future developers.

## Known Issues

* Performance may degrade when many raster layers are visible simultaneously.
* Some naming inconsistencies exist between CSV data and raster layer IDs, requiring manual mapping.
* Duplicate age group options may appear in filter dropdowns in certain scenarios.
