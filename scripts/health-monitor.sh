#!/bin/bash

# WhatsApp Service Health Monitor
# Run this periodically via cron or manually to ensure service health

LOG_FILE="/var/log/whatsapp-health.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Health Check Started ==="

# Check if service is running
SERVICE_STATUS=$(supervisorctl status whatsapp-service | awk '{print $2}')

if [ "$SERVICE_STATUS" != "RUNNING" ]; then
    log "⚠️  Service not running! Status: $SERVICE_STATUS"
    log "Attempting to restart..."
    supervisorctl restart whatsapp-service
    sleep 5
fi

# Check Chromium
if ! command -v chromium &> /dev/null && [ ! -f /usr/bin/chromium ]; then
    log "⚠️  Chromium not found! Installing..."
    apt-get update -qq > /dev/null 2>&1
    apt-get install -y chromium chromium-common > /dev/null 2>&1
    
    if command -v chromium &> /dev/null || [ -f /usr/bin/chromium ]; then
        log "✓ Chromium installed successfully"
        log "Restarting WhatsApp service..."
        supervisorctl restart whatsapp-service
    else
        log "✗ Failed to install Chromium"
    fi
fi

# Check service health endpoint
sleep 2
HEALTH_CHECK=$(curl -s http://localhost:8002/health 2>/dev/null)

if [ $? -eq 0 ]; then
    STATUS=$(echo "$HEALTH_CHECK" | jq -r '.status' 2>/dev/null)
    if [ "$STATUS" = "ok" ]; then
        log "✓ Service health check passed"
    else
        log "⚠️  Service health check failed"
        log "Restarting service..."
        supervisorctl restart whatsapp-service
    fi
else
    log "✗ Cannot connect to service"
    log "Restarting service..."
    supervisorctl restart whatsapp-service
fi

# Check WhatsApp status
WA_STATUS=$(curl -s http://localhost:8002/status 2>/dev/null | jq -r '.status' 2>/dev/null)
log "WhatsApp Status: $WA_STATUS"

if [ "$WA_STATUS" = "error" ]; then
    log "⚠️  WhatsApp in error state"
    log "Cleaning session and restarting..."
    rm -rf /app/whatsapp-service/.wwebjs* 2>/dev/null
    supervisorctl restart whatsapp-service
fi

log "=== Health Check Completed ==="
log ""
