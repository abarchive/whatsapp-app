#!/bin/bash

echo "🔧 WhatsApp Service Fix Script"
echo "================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run with sudo"
    exit 1
fi

echo "1️⃣ Stopping WhatsApp service..."
supervisorctl stop whatsapp-service
sleep 2

echo "2️⃣ Cleaning session data..."
rm -rf /app/whatsapp-service/.wwebjs*
echo "   ✓ Session data cleaned"

echo "3️⃣ Starting WhatsApp service..."
supervisorctl start whatsapp-service
sleep 3

echo "4️⃣ Checking service status..."
STATUS=$(supervisorctl status whatsapp-service | awk '{print $2}')
if [ "$STATUS" == "RUNNING" ]; then
    echo "   ✅ Service is running"
else
    echo "   ❌ Service failed to start"
    echo "   Check logs: tail -n 50 /var/log/supervisor/whatsapp-service.err.log"
    exit 1
fi

echo ""
echo "5️⃣ Waiting for service to initialize..."
sleep 5

echo "6️⃣ Running health check..."
HEALTH=$(curl -s http://localhost:8002/health)
if [ $? -eq 0 ]; then
    echo "   ✅ Health check passed"
    echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"
else
    echo "   ⚠️  Health check failed"
fi

echo ""
echo "7️⃣ Checking WhatsApp status..."
curl -s http://localhost:8002/status | jq '.'

echo ""
echo "================================"
echo "✅ Fix script completed!"
echo ""
echo "Next steps:"
echo "  1. Go to dashboard"
echo "  2. Click 'Initialize WhatsApp & Generate QR Code'"
echo "  3. Wait 10-15 seconds for QR code"
echo "  4. Scan QR code with your phone"
echo ""
