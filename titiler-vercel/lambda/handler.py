"""AWS Lambda handler for Titiler with Cloudflare R2 support."""

import os
from mangum import Mangum
from titiler.application.main import app

# Set environment variables for optimal COG reading
os.environ["GDAL_DISABLE_READDIR_ON_OPEN"] = "EMPTY_DIR"
os.environ["VSI_CACHE"] = "TRUE"
os.environ["GDAL_HTTP_MERGE_CONSECUTIVE_RANGES"] = "YES"
os.environ["GDAL_HTTP_MULTIPLEX"] = "YES"
os.environ["GDAL_HTTP_VERSION"] = "2"
os.environ["PYTHONWARNINGS"] = "ignore"
os.environ["CPL_VSIL_CURL_ALLOWED_EXTENSIONS"] = ".tif,.TIF,.tiff,.TIFF,.xml,.XML,.aux.xml,.AUX.XML"

# Set AWS/R2 environment variables
os.environ["AWS_REGION"] = os.environ.get("AWS_REGION", "auto")
os.environ["AWS_S3_ENDPOINT"] = os.environ.get("AWS_S3_ENDPOINT", "https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev")
R2_BUCKET = os.environ.get("R2_BUCKET", "planeo")

# Create the handler
handler = Mangum(app)