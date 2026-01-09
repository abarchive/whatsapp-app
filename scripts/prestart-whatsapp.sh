#!/bin/bash

# WhatsApp Service Pre-Start Script
# This script ensures Chromium is installed before starting the service

echo "[Pre-Start] Checking Chromium installation..."

# Check if Chromium exists
if command -v chromium &> /dev/null || [ -f /usr/bin/chromium ]; then
    echo "[Pre-Start] ✓ Chromium is already installed"
    exit 0
fi

echo "[Pre-Start] ✗ Chromium not found! Installing..."

# Install Chromium
apt-get update -qq
apt-get install -y chromium chromium-common > /dev/null 2>&1

# Verify installation
if command -v chromium &> /dev/null || [ -f /usr/bin/chromium ]; then
    echo "[Pre-Start] ✓ Chromium installed successfully"
    exit 0
else
    echo "[Pre-Start] ✗ Failed to install Chromium"
    exit 1
fi
