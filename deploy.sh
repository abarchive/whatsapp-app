#!/bin/bash

#############################################
# 🚀 WhatsApp Automation System - One-Click Deploy Script
# For Ubuntu 22.04/24.04 VPS (Hostinger KVM 2/DigitalOcean/etc)
# Version: 2.0 - Fixed & Improved
#############################################

set -e

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

# Error handler
handle_error() {
    print_error "Error occurred at line $1"
    print_error "Check log file: $LOG_FILE"
    exit 1
}

trap 'handle_error $LINENO' ERR

# Banner
clear
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  🚀 WhatsApp Automation System - One-Click Deployment v2.0    ║"
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
DOMAIN=${DOMAIN:-$(curl -s ifconfig.me)}

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
apt upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
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
    build-essential

print_status "Essential tools installed"

#############################################
# Step 3: Install Node.js 20 LTS
#############################################
print_step "Step 3/12: Installing Node.js 20 LTS"

if ! command_exists node || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 18 ]]; then
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

apt install -y python3 python3-pip python3-venv python3-dev

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
    apt install -y mongodb-org
fi

# Start MongoDB
systemctl start mongod
systemctl enable mongod

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

apt install -y nginx
systemctl start nginx
systemctl enable nginx
print_status "Nginx installed and running"

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

# Check where files are
if [[ "$HAS_FILES" == "y" ]] && [ -d "./backend" ]; then
    print_status "Using files from current directory"
elif [ -d "/root/whatsapp-app/backend" ]; then
    print_status "Copying from /root/whatsapp-app..."
    cp -r /root/whatsapp-app/* $APP_DIR/
elif [ -d "/tmp/whatsapp-app/backend" ]; then
    print_status "Copying from /tmp/whatsapp-app..."
    cp -r /tmp/whatsapp-app/* $APP_DIR/
else
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
    pip install -r requirements.txt
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
npm install --legacy-peer-deps 2>/dev/null || yarn install

# Build frontend
CI=false npm run build || CI=false yarn build

print_status "Frontend built successfully"

#############################################
# Step 12: Configure WhatsApp Service
#############################################
print_step "Step 12/12: Configuring WhatsApp Service"

cd $APP_DIR/whatsapp-service

# Install dependencies
npm install 2>/dev/null || yarn install

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

# Create Nginx config
cat > /etc/nginx/sites-available/whatsapp-app << NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend - serve static files
    location / {
        root $APP_DIR/frontend/build;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
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
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
        
        # Increase buffer size for large responses
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
    gzip_comp_level 6;
}
NGINX

# Enable site
ln -sf /etc/nginx/sites-available/whatsapp-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t && systemctl reload nginx
print_status "Nginx configured"

#############################################
# Configure Firewall
#############################################
print_step "Configuring Firewall"

ufw --force reset
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
    
    apt install -y certbot python3-certbot-nginx
    
    # Try to get SSL certificate
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect 2>/dev/null || \
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect 2>/dev/null || \
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
systemctl is-active mongod && echo -e "${GREEN}MongoDB: Running${NC}" || echo -e "${RED}MongoDB: Not Running${NC}"

echo -e "\n${BLUE}📊 Nginx Status:${NC}"
systemctl is-active nginx && echo -e "${GREEN}Nginx: Running${NC}" || echo -e "${RED}Nginx: Not Running${NC}"

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
echo "   pm2 monit            - Real-time monitoring"

echo -e "\n${CYAN}📁 Important Paths:${NC}"
echo "   App Directory: $APP_DIR"
echo "   Nginx Config:  /etc/nginx/sites-available/whatsapp-app"
echo "   Deploy Log:    $LOG_FILE"

echo -e "\n${YELLOW}⚠️  Important Notes:${NC}"
echo "   1. Change admin password after first login"
echo "   2. If using domain, DNS may take 24-48 hours to propagate"
echo "   3. Check logs if any issues: pm2 logs"
echo "   4. WhatsApp QR will appear when you click 'Connect WhatsApp'"

echo -e "\n${GREEN}✅ Your WhatsApp Automation System is now LIVE!${NC}"
echo -e "${GREEN}   Log file: $LOG_FILE${NC}\n"
