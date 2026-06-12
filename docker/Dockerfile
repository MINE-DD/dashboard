# Stage 1: Build static site
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY app/package.json app/bun.lock ./
RUN bun install

# Copy app source
COPY app/ .

# Build arg for MapTiler key (UVA should use their own)
ARG VITE_MAPTILER_KEY=vJWNfIkxpqqguYqYGv4V

# Generate manifest from local CSV files and build static site
# Uses /data/01_Points as the data path (served by nginx from the same build)
ENV VITE_R2_POINTS_BASE_URL=/data/01_Points
ENV VITE_RASTER_BASE_URL=/data/cogs/
ENV VITE_MAPTILER_KEY=${VITE_MAPTILER_KEY}
ENV BASE_PATH=""

RUN bun run update-data-manifest && bunx --bun vite build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
