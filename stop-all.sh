#!/bin/bash

echo "Stopping all services..."

# Read PIDs from file
if [ -f .pids ]; then
    API_PID=$(sed -n '1p' .pids)
    WORKER_PID=$(sed -n '2p' .pids)
    
    echo "Stopping API Server (PID: $API_PID)..."
    kill $API_PID 2>/dev/null
    
    echo "Stopping Worker (PID: $WORKER_PID)..."
    kill $WORKER_PID 2>/dev/null
    
    rm .pids
else
    echo "No PID file found. Trying to find processes..."
    pkill -f "npm run dev"
    pkill -f "npm run worker"
fi

# Stop Redis
echo "Stopping Redis..."
docker stop redis-video-automation 2>/dev/null
docker rm redis-video-automation 2>/dev/null

echo "All services stopped!"
