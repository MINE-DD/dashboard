#!/bin/bash
# Load environment variables from .env file
set -a
[ -f .env ] && . .env
set +a

# Echo loaded variables for debugging (values will be masked in logs)
echo "AWS_ACCESS_KEY_ID is $(if [ -n "$AWS_ACCESS_KEY_ID" ]; then echo "set"; else echo "not set"; fi)"
echo "AWS_SECRET_ACCESS_KEY is $(if [ -n "$AWS_SECRET_ACCESS_KEY" ]; then echo "set"; else echo "not set"; fi)"
echo "AWS_S3_ENDPOINT is $(if [ -n "$AWS_S3_ENDPOINT" ]; then echo "set"; else echo "not set"; fi)"

# Start the Python server
exec "$@"