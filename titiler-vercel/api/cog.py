from titiler.core.factory import TilerFactory
from titiler.core.errors import DEFAULT_STATUS_CODES, add_exception_handlers
from fastapi import FastAPI
from mangum import Mangum
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(title="TiTiler for Mine-DD")

# Create COG tiler factory
cog = TilerFactory()
app.include_router(cog.router, prefix="/cog")

# Add exception handlers
add_exception_handlers(app, DEFAULT_STATUS_CODES)

# Add CORS middleware
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, replace with your specific domain
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Add a health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "titiler"}

# This is necessary for Vercel serverless functions
handler = Mangum(app)
