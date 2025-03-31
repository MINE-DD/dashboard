# COG Integration with TiTiler

This document describes the integration of Cloud-Optimized GeoTIFF (COG) files with the dashboard application using TiTiler.

## Overview

The dashboard application uses [TiTiler](https://developmentseed.org/titiler/) to serve COG files as raster layers on the map. TiTiler is a FastAPI-based dynamic tile server that can serve tiles from COG files.

## Architecture

- **TiTiler Service**: Runs as a Docker container defined in `docker-compose.yml`
- **Data Storage**: COG files are stored in the `data/cogs` directory, which is mounted to the TiTiler container
- **Frontend Integration**: The application uses MapLibre GL JS to display the COG data on the map

## Implementation Details

The implementation uses an image-based approach rather than a tiled approach for displaying COG data. This approach:

1. Loads the entire COG as a single image using TiTiler's preview endpoint
2. Positions the image on the map using geographic coordinates
3. Handles image loading and error states

This approach was chosen because:
- It works reliably on all platforms, including Apple Silicon
- It's simpler than the tiled approach, which can be more complex to debug
- For the current use case with relatively small COG files, it provides good performance

## Usage

### Adding COG Files

1. Place your COG files in the `data/cogs` directory
2. The files will be available to the TiTiler service at the path `/data/[filename]`

### Configuring the COG Layer

The COG layer is configured in the following files:

- `app/src/lib/components/Map/store/stores.ts`: Contains the URL of the COG file and settings for visibility and opacity
- `app/src/lib/components/Map/Map.svelte`: Contains the code for loading and displaying the COG layer

### User Interface

Users can interact with the COG layer through the map sidebar:

- Toggle the "Show Example COG" switch to display/hide the raster layer
- Use the slider to adjust the opacity of the raster layer

## Troubleshooting

If you encounter issues with the COG layer:

1. Check that the TiTiler service is running: `docker compose ps`
2. Verify that the COG file exists in the `data/cogs` directory
3. Test the TiTiler endpoints directly:
   - Info endpoint: `http://localhost:8000/cog/info?url=/data/[filename]`
   - Preview endpoint: `http://localhost:8000/cog/preview.png?url=/data/[filename]&width=256&height=256`
4. Check the browser console for any errors related to image loading

## Future Improvements

Potential improvements to the COG integration:

- Support for multiple COG layers
- Dynamic loading of COG files from a list
- User-configurable styling options (color ramps, etc.)
- True tiled approach for very large COG files
