"""Titiler Vercel Serverless API with Cloudflare R2 support for planeo/cogs structure."""

import os
import re
from typing import Dict, List, Optional, Union

from fastapi import FastAPI, Query, Depends, Path, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import RedirectResponse
from titiler.core.factory import MultiBaseTilerFactory, TilerFactory
from titiler.core.errors import DEFAULT_STATUS_CODES, add_exception_handlers
from titiler.core.resources.enums import OptionalHeader
from titiler.application.main import app as titiler_app

# Create a new FastAPI app
app = FastAPI(title="TiTiler", version="0.1.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set environment variables for optimal COG reading
os.environ["GDAL_DISABLE_READDIR_ON_OPEN"] = "EMPTY_DIR"
os.environ["VSI_CACHE"] = "TRUE"
os.environ["GDAL_HTTP_MERGE_CONSECUTIVE_RANGES"] = "YES"
os.environ["GDAL_HTTP_MULTIPLEX"] = "YES"
os.environ["GDAL_HTTP_VERSION"] = "2"
os.environ["PYTHONWARNINGS"] = "ignore"
os.environ["CPL_VSIL_CURL_ALLOWED_EXTENSIONS"] = ".tif,.TIF,.tiff,.TIFF,.xml,.XML,.aux.xml,.AUX.XML"
os.environ["AWS_REGION"] = os.environ.get("AWS_REGION", "auto")
os.environ["AWS_S3_ENDPOINT"] = os.environ.get("AWS_S3_ENDPOINT", "https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev")

# Set default bucket based on the R2 structure in the screenshot
R2_BUCKET = os.environ.get("R2_BUCKET", "planeo")

# Create the COG tiler factory
cog = TilerFactory()

# Include the routes
app.include_router(cog.router, prefix="/cog", tags=["Cloud Optimized GeoTIFF"])

# Create a multi-base tiler factory for mosaic operations if needed
mosaic = MultiBaseTilerFactory()
app.include_router(
    mosaic.router, prefix="/mosaicjson", tags=["MosaicJSON"]
)

# Add exception handlers
add_exception_handlers(app, DEFAULT_STATUS_CODES)

# Root endpoint
@app.get("/", include_in_schema=False)
def read_root():
    """Redirect to documentation page."""
    return RedirectResponse(url="/docs")

# Health check endpoint
@app.get("/healthz", description="Health Check", tags=["Health Check"])
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "r2_endpoint": os.environ.get("AWS_S3_ENDPOINT"),
        "r2_bucket": R2_BUCKET,
        "r2_credentials": "configured" if os.environ.get("AWS_ACCESS_KEY_ID") else "not_configured"
    }

# Access files from planeo/cogs directly
@app.get("/planeo/{path:path}", description="Access COGs from planeo bucket using simple URL", tags=["R2 Access"])
async def planeo_proxy(
    path: str = Path(..., description="Path to the COG file in planeo bucket"),
    request_path: str = Query("info", description="Titiler endpoint to use (info, tile, bounds, etc.)"),
    **kwargs
):
    """Direct access to COG files in the planeo bucket using a simple path."""
    vsis3_path = f"/vsis3/planeo/{path}"
    return await proxy_to_titiler(vsis3_path, request_path, **kwargs)

# Specific endpoint for pathogens
@app.get("/pathogens/{file_name:path}", description="Access pathogens COGs from the planeo/cogs/01_Pathogens folder", tags=["COGs Access"])
async def pathogens_proxy(
    file_name: str = Path(..., description="Filename in the 01_Pathogens directory"),
    request_path: str = Query("info", description="Titiler path to proxy to"),
    **kwargs
):
    """Endpoint specifically for accessing files in the 01_Pathogens folder."""
    vsis3_path = f"/vsis3/planeo/cogs/01_Pathogens/{file_name}"
    return await proxy_to_titiler(vsis3_path, request_path, **kwargs)

# Specific endpoint for risk factors
@app.get("/risk-factors/{file_name:path}", description="Access risk factors COGs from the planeo/cogs/02_Risk_factors folder", tags=["COGs Access"])
async def risk_factors_proxy(
    file_name: str = Path(..., description="Filename in the 02_Risk_factors directory"),
    request_path: str = Query("info", description="Titiler path to proxy to"),
    **kwargs
):
    """Endpoint specifically for accessing files in the 02_Risk_factors folder."""
    vsis3_path = f"/vsis3/planeo/cogs/02_Risk_factors/{file_name}"
    return await proxy_to_titiler(vsis3_path, request_path, **kwargs)

# Keep backward compatibility with original cogs333 endpoint
@app.get("/cogs333/{file_name:path}", description="Access COGs from the cogs333 folder", tags=["COGs Access"])
async def cogs333_proxy(
    file_name: str = Path(..., description="Filename in the cogs333 directory"),
    request_path: str = Query("info", description="Titiler path to proxy to"),
    **kwargs
):
    """Endpoint specifically for accessing files in the cogs333 folder."""
    # Define which bucket your cogs333 files are in
    bucket = R2_BUCKET or "mine-dd-cogs"  # Use default or fallback to a name
    vsis3_path = f"/vsis3/{bucket}/cogs333/{file_name}"
    return await proxy_to_titiler(vsis3_path, request_path, **kwargs)

# Generic R2 endpoint
@app.get("/r2/{bucket}/{path:path}", description="Access COGs from specified R2 bucket", tags=["R2 Access"])
async def r2_proxy(
    bucket: str = Path(..., description="R2 bucket name"),
    path: str = Path(..., description="Path to COG file in the bucket"),
    request_path: str = Query("info", description="Titiler path to proxy to"),
    **kwargs
):
    """Proxy requests to titiler endpoints using friendly R2 URLs."""
    vsis3_path = f"/vsis3/{bucket}/{path}"
    return await proxy_to_titiler(vsis3_path, request_path, **kwargs)

async def proxy_to_titiler(url: str, request_path: str, **kwargs):
    """Helper function to route requests to the appropriate Titiler endpoint."""
    # Determine which endpoint to call and forward the request
    if request_path == "info":
        return await cog.info(url=url, **kwargs)
    elif request_path == "bounds":
        return await cog.bounds(url=url, **kwargs)
    elif request_path == "metadata":
        return await cog.metadata(url=url, **kwargs)
    elif request_path == "tilejson":
        return await cog.tilejson(url=url, **kwargs)
    elif request_path == "wmts":
        return await cog.wmts(url=url, **kwargs)
    elif request_path == "tile":
        x = int(kwargs.pop("x", 0))
        y = int(kwargs.pop("y", 0))
        z = int(kwargs.pop("z", 0))
        return await cog.tile(url=url, x=x, y=y, z=z, **kwargs)
    else:
        return {"error": f"Unknown request path: {request_path}"}

# Import routes from titiler.application for compatibility
for route in titiler_app.routes:
    if route not in app.routes:
        app.routes.append(route)

# Define Vercel serverless handler function (recommended pattern)
async def handler(request: Request):
    """Vercel serverless function handler for FastAPI app."""
    return await app(request.scope, request._receive, request._send)
