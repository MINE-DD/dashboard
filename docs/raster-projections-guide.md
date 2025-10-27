# Creating Rasters for the Web Dashboard

## Quick Guide

This application displays rasters on a Web Mercator basemap (MapLibre/Mapbox). Follow these guidelines when creating new raster datasets.

## Supported Projections

The application automatically handles both:
- **EPSG:3857 (Web Mercator)** - Best performance, recommended for new datasets
- **EPSG:4326 (Geographic WGS84)** - Automatic reprojection, works but slower

## Creating New Rasters (Recommended)

### Option 1: EPSG:3857 (Web Mercator) - Recommended ⭐

Use this for **new datasets** to get the best web performance.

**Command:**

```bash
# Convert from EPSG:4326 to EPSG:3857 COG
gdalwarp \
  -s_srs EPSG:4326 \
  -t_srs EPSG:3857 \
  -r bilinear \
  -co TILED=YES \
  -co COMPRESS=LZW \
  -co COPY_SRC_OVERVIEWS=YES \
  -of COG \
  input.tif \
  output_web_mercator.tif
```

**Benefits:**
- ✅ Best performance (no client-side reprojection)
- ✅ Instant display on the map
- ✅ Matches existing Shigella rasters

### Option 2: EPSG:4326 (Geographic) - Also Supported

Use this if you receive data in EPSG:4326 or need to preserve it for analysis.

**Command:**

```bash
# Create COG without reprojection
gdal_translate \
  -co TILED=YES \
  -co COMPRESS=LZW \
  -co COPY_SRC_OVERVIEWS=YES \
  -of COG \
  input.tif \
  output_geographic.tif

# Add overviews for better performance
gdaladdo -r average output_geographic.tif 2 4 8 16 32
```

**Benefits:**
- ✅ Automatic client-side reprojection
- ✅ Better for scientific analysis
- ⚠️ Slightly slower initial load

## Standard Workflow

```bash
# Step 1: Check current projection
gdalinfo input.tif | grep -A 5 "Coordinate System"

# Step 2: Convert to EPSG:3857 COG (recommended)
gdalwarp \
  -s_srs EPSG:4326 \
  -t_srs EPSG:3857 \
  -r bilinear \
  -co TILED=YES \
  -co COMPRESS=LZW \
  -co COPY_SRC_OVERVIEWS=YES \
  -of COG \
  input.tif \
  output_web_mercator.tif

# Step 3: Verify the output
gdalinfo output_web_mercator.tif

# Step 4: Upload to R2 storage
# Upload to: pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/
```

## Quick Reference

### Check Projection

```bash
# Check what projection a raster uses
gdalinfo input.tif | grep -A 5 "Coordinate System"
```

**EPSG:3857 output:**
```
PROJCRS["WGS 84 / Pseudo-Mercator"...
ID["EPSG",3857]]
```

**EPSG:4326 output:**
```
GEOGCRS["WGS 84"...
ID["EPSG",4326]]
```

### Inspect Remote COG

```bash
# Check COG from URL
gdalinfo /vsicurl/https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/cogs/file.tif
```

## Comparison

| Aspect | EPSG:4326 | EPSG:3857 |
|--------|-----------|-----------|
| **Recommended for** | Scientific data, analysis | Web visualization ⭐ |
| **Web performance** | Slower (reprojection) | Faster (direct display) |
| **Current use** | Risk Factor rasters | Shigella rasters |
| **Supported** | ✅ Yes | ✅ Yes |

## Key Takeaways

- **For new datasets**: Use EPSG:3857 for best web performance
- **For existing data**: Both projections work, automatic reprojection handles EPSG:4326
- **Always create COGs**: Cloud Optimized GeoTIFF format for efficient streaming

## Additional Resources

- [GDAL Documentation](https://gdal.org/programs/gdalwarp.html)
- [Cloud Optimized GeoTIFF Guide](https://www.cogeo.org/)
