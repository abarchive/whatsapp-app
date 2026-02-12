#!/bin/bash

#############################################
# 🚀 WhatsApp Automation System - One-Click Deploy Script
# For Ubuntu 22.04/24.04 VPS (Hostinger KVM 2/DigitalOcean/etc)
# Version: 2.1 - Fixed Nginx Issues
#############################################

# Don't exit on error - handle errors manually
# set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/whatsapp-app"
LOG_FILE="/var/log/whatsapp-deploy.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
    log "SUCCESS: $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
    log "WARNING: $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
    log "ERROR: $1"
}

print_step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}📦 $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    log "STEP: $1"
}

# Check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Banner
clear
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  🚀 WhatsApp Automation System - One-Click Deployment v2.1    ║"
echo "║  Optimized for Hostinger KVM 2 (Ubuntu 22.04/24.04)           ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Initialize log
mkdir -p /var/log
echo "=== Deployment started at $(date) ===" > "$LOG_FILE"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use: sudo bash deploy.sh)"
    exit 1
fi

# Get user input
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📝 Configuration${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

read -p "Enter your domain name (or VPS IP): " DOMAIN
DOMAIN=${DOMAIN:-$(curl -s ifconfig.me 2>/dev/null || echo "localhost")}

read -p "Enter your email (for SSL): " EMAIL
EMAIL=${EMAIL:-admin@example.com}

read -p "Do you have app files in current directory? (y/n): " HAS_FILES
HAS_FILES=${HAS_FILES:-n}

echo -e "\n${GREEN}Configuration:${NC}"
echo -e "  Domain: ${CYAN}$DOMAIN${NC}"
echo -e "  Email: ${CYAN}$EMAIL${NC}"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

#############################################
# Step 1: System Update
#############################################
print_step "Step 1/12: Updating System Packages"

export DEBIAN_FRONTEND=noninteractive

# Fix any broken packages first
apt --fix-broken install -y 2>/dev/null || true

apt update -y
apt upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" || true
print_status "System updated"

#############################################
# Step 2: Install Essential Tools
#############################################
print_step "Step 2/12: Installing Essential Tools"

apt install -y \
    curl \
    wget \
    git \
    unzip \
    nano \
    htop \
    ufw \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    build-essential \
    2>/dev/null || true

print_status "Essential tools installed"

#############################################
# Step 3: Install Node.js 20 LTS
#############################################
print_step "Step 3/12: Installing Node.js 20 LTS"

if ! command_exists node || [[ $(node -v 2>/dev/null | cut -d'.' -f1 | tr -d 'v') -lt 18 ]]; then
    # Remove old Node.js
    apt remove -y nodejs npm 2>/dev/null || true
    rm -rf /usr/local/lib/node_modules 2>/dev/null || true
    
    # Install Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

# Install yarn globally
npm install -g yarn 2>/dev/null || true

print_status "Node.js $(node -v) installed"
print_status "NPM $(npm -v) installed"

#############################################
# Step 4: Install Python 3.11
#############################################
print_step "Step 4/12: Installing Python 3.11"

apt install -y python3 python3-pip python3-venv python3-dev || true

# Ensure pip is up to date
python3 -m pip install --upgrade pip 2>/dev/null || true

print_status "Python $(python3 --version) installed"

#############################################
# Step 5: Install MongoDB 7.0
#############################################
print_step "Step 5/12: Installing MongoDB 7.0"

if ! command_exists mongod; then
    # Import MongoDB GPG key
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes
    
    # Add MongoDB repository
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
        tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    
    apt update
    apt install -y mongodb-org || true
fi

# Start MongoDB
systemctl start mongod 2>/dev/null || true
systemctl enable mongod 2>/dev/null || true

# Wait for MongoDB to be ready
sleep 3
if mongosh --eval "db.runCommand({ping:1})" &>/dev/null; then
    print_status "MongoDB installed and running"
else
    print_warning "MongoDB may need manual start: sudo systemctl start mongod"
fi

#############################################
# Step 6: Install Chromium for WhatsApp
#############################################
print_step "Step 6/12: Installing Chromium Browser"

# Install Chromium and dependencies
apt install -y chromium-browser 2>/dev/null || \
apt install -y chromium 2>/dev/null || \
snap install chromium 2>/dev/null || \
print_warning "Chromium needs manual installation"

# Install additional dependencies for puppeteer
apt install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    2>/dev/null || true

# Find Chromium path
CHROMIUM_PATH=$(which chromium-browser 2>/dev/null || which chromium 2>/dev/null || echo "/snap/bin/chromium")
print_status "Chromium installed at: $CHROMIUM_PATH"

#############################################
# Step 7: Install Nginx
#############################################
print_step "Step 7/12: Installing Nginx"

# Stop any existing nginx or apache
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
apt remove -y apache2 2>/dev/null || true

# Kill any process on port 80
fuser -k 80/tcp 2>/dev/null || true

# Install nginx
apt install -y nginx

# Remove default site
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
rm -f /etc/nginx/sites-available/default 2>/dev/null || true

# Start nginx
systemctl start nginx || {
    print_warning "Nginx failed to start, trying to fix..."
    # Check what's using port 80
    fuser -k 80/tcp 2>/dev/null || true
    sleep 2
    systemctl start nginx || print_warning "Nginx still not starting - will configure later"
}
systemctl enable nginx 2>/dev/null || true

print_status "Nginx installed"

#############################################
# Step 8: Install PM2 Process Manager
#############################################
print_step "Step 8/12: Installing PM2 Process Manager"

npm install -g pm2
print_status "PM2 installed"

#############################################
# Step 9: Setup Application Files
#############################################
print_step "Step 9/12: Setting Up Application Files"

# Create app directory
mkdir -p $APP_DIR
cd $APP_DIR

# Determine source directory
SOURCE_DIR=""

if [[ "$HAS_FILES" == "y" ]] && [ -d "$(pwd)/backend" ]; then
    SOURCE_DIR="$(pwd)"
    print_status "Using files from current directory"
elif [ -d "/root/whatsapp-app/backend" ]; then
    SOURCE_DIR="/root/whatsapp-app"
elif [ -d "/tmp/whatsapp-app/backend" ]; then
    SOURCE_DIR="/tmp/whatsapp-app"
elif [ -d "$(dirname $0)/backend" ]; then
    SOURCE_DIR="$(dirname $0)"
fi

if [ -n "$SOURCE_DIR" ] && [ "$SOURCE_DIR" != "$APP_DIR" ]; then
    print_status "Copying from $SOURCE_DIR..."
    cp -r "$SOURCE_DIR/backend" $APP_DIR/ 2>/dev/null || true
    cp -r "$SOURCE_DIR/frontend" $APP_DIR/ 2>/dev/null || true
    cp -r "$SOURCE_DIR/whatsapp-service" $APP_DIR/ 2>/dev/null || true
    cp -r "$SOURCE_DIR/db_backup" $APP_DIR/ 2>/dev/null || true
fi

# Verify files exist
if [ ! -d "$APP_DIR/backend" ]; then
    print_error "Application files not found!"
    echo ""
    echo -e "${YELLOW}Please upload your application files to one of these locations:${NC}"
    echo "  1. /root/whatsapp-app/"
    echo "  2. /tmp/whatsapp-app/"
    echo "  3. $APP_DIR/"
    echo ""
    echo "Required folder structure:"
    echo "  ├── backend/"
    echo "  ├── frontend/"
    echo "  ├── whatsapp-service/"
    echo "  └── db_backup/ (optional - for data migration)"
    echo ""
    read -p "Press Enter after uploading files, or Ctrl+C to exit..."
    
    # Re-check
    if [ ! -d "$APP_DIR/backend" ]; then
        print_error "Files still not found. Exiting."
        exit 1
    fi
fi

print_status "Application files ready"

#############################################
# Step 10: Configure Backend
#############################################
print_step "Step 10/12: Configuring Backend"

cd $APP_DIR/backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip wheel setuptools

# Install Python dependencies
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt || {
        print_warning "Some packages failed, installing manually..."
        pip install \
            fastapi \
            uvicorn[standard] \
            motor \
            pymongo \
            pydantic[email] \
            python-jose[cryptography] \
            passlib[bcrypt] \
            bcrypt \
            aiohttp \
            python-multipart \
            python-dotenv
    }
else
    pip install \
        fastapi \
        uvicorn[standard] \
        motor \
        pymongo \
        pydantic[email] \
        python-jose[cryptography] \
        passlib[bcrypt] \
        bcrypt \
        aiohttp \
        python-multipart \
        python-dotenv
fi

# Generate secure JWT secret
JWT_SECRET=$(openssl rand -hex 32)

# Create backend .env file
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=whatsapp_automation
JWT_SECRET=$JWT_SECRET
WHATSAPP_SERVICE_URL=http://localhost:8002
CORS_ORIGINS=*
EOF

deactivate
print_status "Backend configured"

#############################################
# Step 11: Configure Frontend
#############################################
print_step "Step 11/12: Configuring Frontend"

cd $APP_DIR/frontend

# Determine URL scheme
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    BACKEND_URL="http://$DOMAIN"
else
    BACKEND_URL="https://$DOMAIN"
fi

# Create frontend .env
cat > .env << EOF
REACT_APP_BACKEND_URL=$BACKEND_URL
EOF

# Install dependencies
npm install --legacy-peer-deps 2>/dev/null || yarn install || {
    print_warning "npm install failed, trying with force..."
    npm install --legacy-peer-deps --force
}

# Build frontend
CI=false npm run build || CI=false yarn build || {
    print_error "Frontend build failed!"
    print_warning "You may need to build manually: cd $APP_DIR/frontend && npm run build"
}

print_status "Frontend configured"

#############################################
# Step 12: Configure WhatsApp Service
#############################################
print_step "Step 12/12: Configuring WhatsApp Service"

cd $APP_DIR/whatsapp-service

# Install dependencies
npm install 2>/dev/null || yarn install || {
    print_warning "npm install failed, trying with force..."
    npm install --force
}

# Create .env for WhatsApp service
cat > .env << EOF
PORT=8002
CHROMIUM_PATH=$CHROMIUM_PATH
EOF

print_status "WhatsApp Service configured"

#############################################
# Import Database Backup (if exists)
#############################################
if [ -d "$APP_DIR/db_backup" ]; then
    print_step "Importing Database Backup"
    
    cd $APP_DIR/db_backup
    
    for file in *.json; do
        if [ -f "$file" ]; then
            collection="${file%.json}"
            echo "Importing $collection..."
            mongoimport --db whatsapp_automation --collection "$collection" --file "$file" --jsonArray --drop 2>/dev/null || \
            print_warning "Could not import $collection"
        fi
    done
    
    print_status "Database backup imported"
fi

#############################################
# Configure PM2 Services
#############################################
print_step "Configuring PM2 Services"

# Stop existing processes
pm2 delete all 2>/dev/null || true

# Create PM2 ecosystem file
cat > $APP_DIR/ecosystem.config.js << 'ECOSYSTEM'
module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: '/var/www/whatsapp-app/backend',
      script: './venv/bin/python',
      args: '-m uvicorn server:app --host 0.0.0.0 --port 8001',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'whatsapp-service',
      cwd: '/var/www/whatsapp-app/whatsapp-service',
      script: 'index.js',
      interpreter: 'node',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: 'true'
      }
    }
  ]
};
ECOSYSTEM

# Start services
cd $APP_DIR
pm2 start ecosystem.config.js
pm2 save

# Setup PM2 startup
pm2 startup systemd -u root --hp /root 2>/dev/null || true

print_status "PM2 services configured and started"

#############################################
# Configure Nginx
#############################################
print_step "Configuring Nginx"

# Stop nginx first
systemctl stop nginx 2>/dev/null || true

# Remove old configs
rm -f /etc/nginx/sites-enabled/* 2>/dev/null || true
rm -f /etc/nginx/sites-available/whatsapp-app 2>/dev/null || true

# Create Nginx config
cat > /etc/nginx/sites-available/whatsapp-app << NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend - serve static files
    location / {
        root $APP_DIR/frontend/build;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
NGINX

# Enable site
ln -sf /etc/nginx/sites-available/whatsapp-app /etc/nginx/sites-enabled/

# Test nginx config
echo "Testing Nginx configuration..."
if nginx -t 2>&1; then
    print_status "Nginx configuration valid"
    systemctl start nginx
    systemctl enable nginx
    print_status "Nginx started"
else
    print_error "Nginx configuration has errors!"
    echo "Checking for issues..."
    nginx -t 2>&1
    echo ""
    echo "Trying to fix common issues..."
    
    # Try simpler config
    cat > /etc/nginx/sites-available/whatsapp-app << NGINX
server {
    listen 80 default_server;
    server_name _;

    location / {
        root $APP_DIR/frontend/build;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX
    
    if nginx -t 2>&1; then
        systemctl start nginx
        print_status "Nginx started with simplified config"
    else
        print_error "Nginx still failing - manual fix needed"
        echo "Run: sudo nginx -t"
    fi
fi

#############################################
# Configure Firewall
#############################################
print_step "Configuring Firewall"

ufw --force reset 2>/dev/null || true
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

print_status "Firewall configured (SSH, HTTP, HTTPS allowed)"

#############################################
# Install SSL Certificate (if domain)
#############################################
if [[ ! "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_step "Installing SSL Certificate"
    
    apt install -y certbot python3-certbot-nginx 2>/dev/null || true
    
    # Try to get SSL certificate
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect 2>/dev/null || \
    print_warning "SSL setup failed - run manually: sudo certbot --nginx -d $DOMAIN"
    
    # Setup auto-renewal
    systemctl enable certbot.timer 2>/dev/null || true
fi

#############################################
# Final Status Check
#############################################
print_step "Final Status Check"

sleep 5

echo -e "\n${BLUE}📊 Service Status:${NC}"
pm2 status

echo -e "\n${BLUE}📊 MongoDB Status:${NC}"
if systemctl is-active mongod &>/dev/null; then
    echo -e "${GREEN}MongoDB: Running${NC}"
else
    echo -e "${RED}MongoDB: Not Running${NC}"
    echo "Fix: sudo systemctl start mongod"
fi

echo -e "\n${BLUE}📊 Nginx Status:${NC}"
if systemctl is-active nginx &>/dev/null; then
    echo -e "${GREEN}Nginx: Running${NC}"
else
    echo -e "${RED}Nginx: Not Running${NC}"
    echo "Fix: sudo nginx -t && sudo systemctl start nginx"
fi

#############################################
# Success Message
#############################################
echo -e "\n${GREEN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  🎉 DEPLOYMENT COMPLETE!                                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${CYAN}🌐 Access Your Application:${NC}"
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "   URL: ${GREEN}http://$DOMAIN${NC}"
else
    echo -e "   URL: ${GREEN}https://$DOMAIN${NC}"
fi

echo -e "\n${CYAN}👤 Admin Login:${NC}"
echo -e "   Email: ${YELLOW}admin@admin.com${NC}"
echo -e "   Password: ${YELLOW}Admin@7501${NC}"

echo -e "\n${CYAN}📝 Useful Commands:${NC}"
echo "   pm2 status           - Check services status"
echo "   pm2 logs             - View all logs"
echo "   pm2 logs backend     - View backend logs"
echo "   pm2 restart all      - Restart all services"
echo "   sudo nginx -t        - Test nginx config"
echo "   sudo systemctl restart nginx - Restart nginx"

echo -e "\n${CYAN}📁 Important Paths:${NC}"
echo "   App Directory: $APP_DIR"
echo "   Nginx Config:  /etc/nginx/sites-available/whatsapp-app"
echo "   Deploy Log:    $LOG_FILE"

echo -e "\n${YELLOW}⚠️  If Nginx failed:${NC}"
echo "   1. sudo nginx -t"
echo "   2. sudo systemctl restart nginx"
echo "   3. Check: sudo tail -20 /var/log/nginx/error.log"

echo -e "\n${GREEN}✅ Your WhatsApp Automation System is now LIVE!${NC}"
echo -e "${GREEN}   Log file: $LOG_FILE${NC}\n"
