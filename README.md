# Plan-EO Dashboard

Interactive geospatial dashboard for visualizing pathogen prevalence data from the Plan-EO (Planetary Child Health and Enterics Observatory) and MINE-DD research initiatives.

## Overview

The Plan-EO Dashboard is a web application that enables researchers, policymakers, and public health professionals to explore pathogen prevalence data across geographic regions. It combines point-level study data with raster prevalence maps, providing multiple visualization modes and advanced filtering. The dashboard is a fully static site -- no database or backend server required -- served via Docker and nginx.

## Features

- Interactive map with multiple visualization modes (dots, pie charts, 3D bars, heatmap, hexbin)
- Raster layer overlays for pathogen prevalence and risk factors (Cloud Optimized GeoTIFFs)
- Advanced filtering by pathogen (20+), age group, and syndrome
- Config-driven raster layers -- add/remove layers by editing `raster-layers.json`, no code changes needed
- Confidence interval display for both point data and raster layers
- Fully static site -- minimal server resources (~10MB RAM), no database required

## Quick Start

### Production Deployment (Docker)

Prerequisites: Docker and Docker Compose installed on a Linux server.

```bash
# Clone the repository
git clone https://github.com/YOUR-ORG/dashboard.git
cd dashboard

# Place raster GeoTIFF files in ./raster-data/ (see Deployment Guide)

# Start the dashboard
docker compose -f docker-compose.prod.yml up -d
```

The dashboard runs at `http://your-server:8080`.

Full setup instructions (GitHub Container Registry, Watchtower auto-updates, raster volume mounts): [Deployment Guide](docs/DEPLOYMENT.md)

### Development

Prerequisites: Docker Desktop OR Bun.

```bash
# Option 1: Docker (runs at localhost:4000)
docker compose up -d

# Option 2: Local development (runs at localhost:5173)
cd app
bun install
bun run dev
```

## Documentation

| Document | Description |
|----------|-------------|
| [Deployment Guide](docs/DEPLOYMENT.md) | Server setup, Docker configuration, auto-updates, raster volume mounts |
| [Researcher Guide](docs/RESEARCHER-GUIDE.md) | Adding/removing point data (CSV) and raster layers (GeoTIFF) |
| [Architecture](docs/architecture.md) | Technical architecture, code structure, data flow, development patterns |

## Data Management

### Point Data (CSV)

- Stored in `app/static/data/01_Points/`
- File naming: `YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv`
- Upload via GitHub -- triggers automatic Docker image rebuild
- See [Researcher Guide](docs/RESEARCHER-GUIDE.md) for column requirements and upload steps

### Raster Layers (GeoTIFF)

- Served from Docker volume mount (`./raster-data/` on the host)
- Configured via `raster-layers.json` -- no code changes needed
- Changes take effect immediately on browser refresh, no restart required
- See [Researcher Guide](docs/RESEARCHER-GUIDE.md) for configuration details

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | SvelteKit 5 (Svelte 5 runes API) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + DaisyUI |
| Mapping | MapLibre GL JS |
| Raster Processing | GeoTIFF.js (client-side COG processing) |
| Runtime | Bun |
| Deployment | Docker + nginx (static site) |

## Team and Organizations

- University of Amsterdam
- Amsterdam University Medical Centers
- Netherlands eScience Center
- University of Virginia School of Medicine

## Resources

- [Plan-EO Homepage](https://www.planeo.earth/)
- [Plan-EO Protocol Paper](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0297775)
- [MINE-DD GitHub Repository](https://github.com/MINE-DD)
- [Plan-EO Webinar](https://www.youtube.com/watch?v=XyjjLnjj8Lw)

## License

[License information to be added]
