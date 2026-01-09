# WhatsApp Service - Troubleshooting Guide

## Common Issues & Solutions

### Issue 1: QR Code Not Generating (Spinner Keeps Running)

**Symptoms:**
- Click "Initialize WhatsApp" button
- Spinner shows "Initializing..."
- QR code never appears (even after 1-2 minutes)

**Root Causes & Solutions:**

#### A. Chromium Browser Issue
```bash
# Check if Chromium is installed
which chromium

# If not found, install it
sudo apt-get update
sudo apt-get install -y chromium chromium-common

# Verify installation
chromium --version
```

#### B. WhatsApp Service Crash/Hang
```bash
# Check service status
sudo supervisorctl status whatsapp-service

# If not running, restart it
sudo supervisorctl restart whatsapp-service

# Check logs for errors
tail -n 50 /var/log/supervisor/whatsapp-service.err.log
```

#### C. Corrupted Session Data
```bash
# Clean session folder
rm -rf /app/whatsapp-service/.wwebjs*

# Restart service
sudo supervisorctl restart whatsapp-service
```

#### D. Service Health Check
```bash
# Check if service is healthy
curl http://localhost:8002/health

# Expected response:
# {
#   "status": "ok",
#   "whatsapp": {
#     "connectionStatus": "disconnected",
#     "isConnected": false,
#     ...
#   }
# }
```

### Issue 2: Service Not Responding After Long Idle

**Symptoms:**
- App works fine initially
- Next day or after hours, QR code generation fails
- Service appears stuck

**Solutions:**

#### A. Automatic Service Restart
```bash
# Supervisor is configured to auto-restart
# Check configuration
cat /etc/supervisor/conf.d/whatsapp-service.conf

# Should have:
# autostart=true
# autorestart=true
```

#### B. Manual Service Restart
```bash
# Restart WhatsApp service
sudo supervisorctl restart whatsapp-service

# Wait 5 seconds
sleep 5

# Check status
sudo supervisorctl status whatsapp-service
```

#### C. Complete System Reset
```bash
# Clean everything and restart
rm -rf /app/whatsapp-service/.wwebjs*
sudo supervisorctl restart whatsapp-service backend frontend

# Wait for services to start
sleep 5

# Verify all services running
sudo supervisorctl status
```

### Issue 3: Browser Timeout During Initialization

**Symptoms:**
- Service logs show: "Initialization timeout after 90 seconds"
- QR code generation fails

**Solutions:**

#### A. Check System Resources
```bash
# Check memory usage
free -h

# Check disk space
df -h

# If low on resources, restart services
sudo supervisorctl restart all
```

#### B. Increase Timeout (if needed)
Edit `/app/whatsapp-service/index.js`:
```javascript
// Current timeout: 90 seconds
const initTimeout = setTimeout(() => {
  // ...
}, 90000);

// Can increase to 120 seconds if needed
}, 120000);
```

### Issue 4: Pink/Red Oval Error

**Symptoms:**
- Dashboard shows a pink or red oval indicator
- No clear error message

**Root Cause:**
- Service status is "error"
- Frontend not handling error state properly

**Solutions:**

#### A. Check Service Status
```bash
curl http://localhost:8002/status

# If response shows "error", restart service
sudo supervisorctl restart whatsapp-service
```

#### B. Check Browser Console
- Open browser DevTools (F12)
- Look for red errors in Console tab
- Common errors:
  - 401: Token expired → Logout and login again
  - 503: Service unavailable → Restart service
  - Network error: Check backend connection

### Issue 5: Session Corruption

**Symptoms:**
- QR code generates but fails to connect
- "Authentication failure" in logs
- Multiple failed connection attempts

**Solutions:**

#### A. Complete Session Reset
```bash
# Stop service
sudo supervisorctl stop whatsapp-service

# Delete all session data
rm -rf /app/whatsapp-service/.wwebjs*

# Start service
sudo supervisorctl start whatsapp-service

# Wait and check
sleep 5
curl http://localhost:8002/status
```

## Monitoring Commands

### Check All Services
```bash
sudo supervisorctl status
```

### View Real-time Logs
```bash
# WhatsApp service
tail -f /var/log/supervisor/whatsapp-service.out.log

# Backend
tail -f /var/log/supervisor/backend.out.log

# Frontend
tail -f /var/log/supervisor/frontend.out.log
```

### Check Errors
```bash
# WhatsApp service errors
tail -n 100 /var/log/supervisor/whatsapp-service.err.log

# Backend errors
tail -n 100 /var/log/supervisor/backend.err.log
```

### Health Checks
```bash
# WhatsApp service
curl http://localhost:8002/health

# WhatsApp status
curl http://localhost:8002/status

# Backend API
curl http://localhost:8001/api/
```

## Quick Fix Script

Create a file `/app/scripts/fix-whatsapp.sh`:

```bash
#!/bin/bash
echo "🔧 Fixing WhatsApp Service..."

# Stop service
sudo supervisorctl stop whatsapp-service

# Clean session data
rm -rf /app/whatsapp-service/.wwebjs*
echo "✓ Session data cleaned"

# Start service
sudo supervisorctl start whatsapp-service
echo "✓ Service restarted"

# Wait for service to be ready
sleep 5

# Check health
echo "🏥 Health Check:"
curl -s http://localhost:8002/health | jq

echo ""
echo "✅ Done! Try generating QR code now."
```

Make it executable:
```bash
chmod +x /app/scripts/fix-whatsapp.sh
```

Run it when needed:
```bash
/app/scripts/fix-whatsapp.sh
```

## Prevention Tips

### 1. Regular Health Checks
Add a cron job to monitor service health:
```bash
# Edit crontab
crontab -e

# Add this line (check every 5 minutes)
*/5 * * * * curl -s http://localhost:8002/health || sudo supervisorctl restart whatsapp-service
```

### 2. Log Rotation
Prevent logs from filling disk:
```bash
# Check log sizes
du -sh /var/log/supervisor/*

# If too large, rotate logs
sudo supervisorctl restart all
```

### 3. Resource Monitoring
```bash
# Check if system has enough resources
free -h
df -h

# If memory is low, consider restarting services periodically
```

## Contact Support

If issues persist after trying above solutions:
1. Collect logs: `/var/log/supervisor/whatsapp-service.err.log`
2. Take screenshots of error states
3. Note exact steps to reproduce the issue
4. Contact support with all information

## Version Information

- WhatsApp Web.js: Latest (whatsapp-web.js)
- Chromium: Installed via apt
- Node.js: v20.x
- Service Port: 8002
- Auto-restart: Enabled
- Browser Timeout: 60 seconds
- Initialization Timeout: 90 seconds
