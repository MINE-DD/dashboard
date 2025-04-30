#!/bin/bash
# build.sh - Helper script for Vercel deployment with GDAL

# Set environment variables needed for GDAL build
export GDAL_VERSION=3.4.3
export PYTHONWARNINGS=ignore

# Inform about the build process
echo "Building with GDAL version $GDAL_VERSION"

# Continue with normal build process
exec "$@"