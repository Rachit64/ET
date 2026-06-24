#!/bin/bash

# Terminate both processes on Ctrl+C
trap "kill 0" EXIT

echo "=========================================================="
echo "Starting Energy Supply Chain Resilience Command Center..."
echo "=========================================================="

# Start Backend Server
echo "-> Launching FastAPI Backend on http://localhost:8000..."
PYTHONPATH=. uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload &

# Start Frontend Dev Server
echo "-> Launching React Frontend on http://localhost:5173..."
npm run dev -- --port 5173 &

# Wait for both processes
wait
