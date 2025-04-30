#!/bin/bash
# build.sh - Helper script for Vercel deployment with GDAL

# Set environment variables needed for GDAL build
export GDAL_VERSION=3.4.3
export PYTHONWARNINGS=ignore
export PIP_NO_BINARY=":all:"
export PIP_NO_BUILD_ISOLATION=false
export PIP_USER=0
export PIP_DISABLE_PIP_VERSION_CHECK=1
export PIP_RETRIES=10
export PIP_TIMEOUT=100

# Inform about the build process
echo "Building with GDAL version $GDAL_VERSION using Python $(python --version)"

# Make sure we have an up-to-date pip and setuptools
python -m pip install --upgrade pip setuptools wheel --timeout 100 --retries 10

# Try to install dependencies with exponential backoff retry strategy
attempt=1
max_attempts=5
timeout_seconds=5

while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt to install dependencies..."
    "$@" && break
    
    # If we get here, the command failed
    exit_code=$?
    
    if [ $attempt -eq $max_attempts ]; then
        echo "Installation failed after $max_attempts attempts"
        exit $exit_code
    fi
    
    # Calculate wait time with exponential backoff (5s, 10s, 20s, 40s)
    wait_time=$((timeout_seconds * 2 ** (attempt - 1)))
    echo "Waiting $wait_time seconds before retry..."
    sleep $wait_time
    
    # Increment attempt counter
    ((attempt++))
done

# Continue with normal build process
exit 0