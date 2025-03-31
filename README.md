# MINE-DD Dashboard

## Project Overview

This project is the dashboard component for MINE-DD, an initiative by the Netherlands eScience Center. Its primary purpose is to serve and visualize data on an interactive map.

## Problem Solved

The dashboard provides an interactive interface for visualizing geographical data relevant to the MINE-DD project.

## Tech Stack

![](./techstack.excalidraw.png)

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
    *   COG files are expected to be located in the `data/cogs` directory (Note: This directory might need to be created if not present).
    *   Displays COG data using an image-based approach compatible across platforms, including Apple Silicon.
    *   Allows users to toggle the visibility and adjust the opacity of raster layers.

## Development Setup

*(Details on how to set up the development environment will be added here later.)*

## System Architecture

*(A description or diagram of the system architecture will be added here later.)*

## Recent Changes

*(This section will track significant updates to the project.)*

## Next Steps

*(This section will outline planned features and improvements.)*

## Known Issues

*(This section will list any known bugs or limitations.)*
