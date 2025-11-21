#!/bin/bash

echo "========================================"
echo "  YouTube Video Automation Pipeline"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Redis
echo "[1/5] Checking Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is already running!${NC}"
else
    echo -e "${YELLOW}Starting Redis with Docker...${NC}"
    docker run -d --name redis-video-automation -p 6379:6379 redis:7-alpine
    sleep 3
    
    if redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis started successfully!${NC}"
    else
        echo -e "${RED}✗ Failed to start Redis${NC}"
        exit 1
    fi
fi

# Build project
echo ""
echo "[2/5] Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build successful!${NC}"

# Start API server
echo ""
echo "[3/5] Starting API Server..."
npm run dev > logs/api-server.log 2>&1 &
API_PID=$!
echo "API Server PID: $API_PID"
sleep 5

# Check if API server is running
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API Server started successfully!${NC}"
else
    echo -e "${YELLOW}⚠ API Server may still be starting...${NC}"
fi

# Start worker
echo ""
echo "[4/5] Starting Worker..."
npm run worker > logs/worker.log 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID"
sleep 3
echo -e "${GREEN}✓ Worker started successfully!${NC}"

# Open browser
echo ""
echo "[5/5] Opening Web Interface..."
sleep 2

# Detect OS and open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open http://localhost:3000/upload.html
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open http://localhost:3000/upload.html 2>/dev/null || echo "Please open: http://localhost:3000/upload.html"
fi

echo ""
echo "========================================"
echo "  All Services Started Successfully!"
echo "========================================"
echo ""
echo -e "${GREEN}Access Points:${NC}"
echo "  - Upload Video: http://localhost:3000/upload.html"
echo "  - Preview: http://localhost:3000/preview.html"
echo "  - API: http://localhost:3000/api"
echo ""
echo -e "${GREEN}Logs Location:${NC}"
echo "  - All logs: logs/combined.log"
echo "  - Errors: logs/error.log"
echo "  - API Server: logs/api-server.log"
echo "  - Worker: logs/worker.log"
echo ""
echo -e "${GREEN}Data Storage (in project):${NC}"
echo "  - Uploads: temp/uploads/"
echo "  - Final videos: temp/final-videos/"
echo "  - Cache: cache/broll/"
echo ""
echo -e "${YELLOW}Process IDs:${NC}"
echo "  - API Server: $API_PID"
echo "  - Worker: $WORKER_PID"
echo ""
echo -e "${RED}To stop all services:${NC}"
echo "  kill $API_PID $WORKER_PID"
echo "  docker stop redis-video-automation"
echo ""
echo "Or run: ./stop-all.sh"
echo ""

# Save PIDs to file for stop script
echo "$API_PID" > .pids
echo "$WORKER_PID" >> .pids

echo "Press Ctrl+C to view logs, or close terminal to keep running in background"
echo ""

# Follow logs
tail -f logs/combined.log
