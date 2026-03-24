# Base image
FROM python:3.11-slim

# Install system tools + Bun
RUN apt-get update && apt-get install -y curl unzip \
    && curl -fsSL https://bun.sh/install | bash \
    && ln -s /root/.bun/bin/bun /usr/local/bin/bun

# Set working directory to dashboard root
WORKDIR /app

# Copy everything from build context
COPY . /app

# Install backend dependencies
WORKDIR /app/chat-backend
RUN pip install --no-cache-dir \
    fastapi==0.104.1 \
    uvicorn[standard]==0.24.0 \
    pydantic==2.5.0 \
    python-multipart==0.0.6

# Back to root
WORKDIR /app

# Expose ports
EXPOSE 4000 4040

# Start backend + frontend
CMD sh -c "uvicorn chat-backend.main:app --host 0.0.0.0 --port 4040 & cd app && bun install && bun run dev --host 0.0.0.0 --port 4000"