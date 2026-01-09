#!/bin/bash

# Continuous health monitoring loop
# Runs every 5 minutes

while true; do
    /app/scripts/health-monitor.sh
    sleep 300  # 5 minutes
done
