# Railway Optimized Dockerfile
# Single service combining API + Worker for Railway deployment
FROM node:18-slim

# Install system dependencies (FFmpeg, Python, Chromium for Remotion)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    chromium \
    fonts-liberation \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages for video processing
RUN pip3 install --no-cache-dir --break-system-packages auto-editor openai

# Set Chromium path for Remotion
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create temp directories
RUN mkdir -p temp/uploads temp/previews cache logs

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start API server
CMD ["node", "dist/server.js"]
