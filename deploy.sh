#!/bin/bash

#############################################
# 🚀 WhatsApp Automation System - One-Click Deploy Script
# For Ubuntu 22.04 VPS (Hostinger/DigitalOcean/etc)
#############################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - CHANGE THESE VALUES
DOMAIN="yourdomain.com"           # आपका domain (या VPS IP)
EMAIL="your@email.com"            # SSL certificate के लिए
APP_DIR="/var/www/whatsapp-app"
GITHUB_REPO=""                     # Optional: GitHub repo URL

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  🚀 WhatsApp Automation System - One-Click Deployment     ║"
echo "║  Version: 1.0                                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📦 $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use: sudo ./deploy.sh)"
    exit 1
fi

# Get domain from user
echo -e "${YELLOW}"
read -p "Enter your domain name (or VPS IP if no domain): " DOMAIN
read -p "Enter your email (for SSL certificate): " EMAIL
echo -e "${NC}"

#############################################
# Step 1: System Update
#############################################
print_step "Step 1/10: Updating System"

apt update && apt upgrade -y
print_status "System updated"

#############################################
# Step 2: Install Basic Tools
#############################################
print_step "Step 2/10: Installing Basic Tools"

apt install -y curl wget git unzip nano ufw software-properties-common apt-transport-https ca-certificates gnupg
print_status "Basic tools installed"

#############################################
# Step 3: Install Node.js 20
#############################################
print_step "Step 3/10: Installing Node.js 20"

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
print_status "Node.js $(node -v) installed"

#############################################
# Step 4: Install Python 3.11
#############################################
print_step "Step 4/10: Installing Python 3.11"

apt install -y python3 python3-pip python3-venv
print_status "Python $(python3 --version) installed"

#############################################
# Step 5: Install MongoDB
#############################################
print_step "Step 5/10: Installing MongoDB"

if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt update
    apt install -y mongodb-org
fi
systemctl start mongod
systemctl enable mongod
print_status "MongoDB installed and running"

#############################################
# Step 6: Install Chromium & Nginx
#############################################
print_step "Step 6/10: Installing Chromium & Nginx"

apt install -y chromium-browser || apt install -y chromium || print_warning "Chromium installation may need manual setup"
apt install -y nginx
print_status "Chromium & Nginx installed"

#############################################
# Step 7: Install PM2
#############################################
print_step "Step 7/10: Installing PM2 Process Manager"

npm install -g pm2
print_status "PM2 installed"

#############################################
# Step 8: Setup Application
#############################################
print_step "Step 8/10: Setting Up Application"

# Create app directory
mkdir -p $APP_DIR

# Check if files exist or need to be downloaded
if [ -d "/app/backend" ]; then
    # Copy from current location (Emergent environment)
    print_status "Copying application files..."
    cp -r /app/backend $APP_DIR/
    cp -r /app/frontend $APP_DIR/
    cp -r /app/whatsapp-service $APP_DIR/
else
    print_warning "Application files not found. Please upload them manually to $APP_DIR"
    print_warning "Required folders: backend, frontend, whatsapp-service"
fi

# Setup Backend
print_status "Setting up Backend..."
cd $APP_DIR/backend

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt 2>/dev/null || pip install fastapi uvicorn motor pymongo pydantic python-jose passlib bcrypt aiohttp python-multipart

# Create backend .env
JWT_SECRET=$(openssl rand -hex 32)
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=whatsapp_automation
JWT_SECRET=$JWT_SECRET
JWT_ALGORITHM=HS256
WHATSAPP_SERVICE_URL=http://localhost:8002
EOF

deactivate
print_status "Backend configured"

# Setup Frontend
print_status "Setting up Frontend..."
cd $APP_DIR/frontend

# Create frontend .env
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # It's an IP address
    cat > .env << EOF
REACT_APP_BACKEND_URL=http://$DOMAIN
EOF
else
    # It's a domain
    cat > .env << EOF
REACT_APP_BACKEND_URL=https://$DOMAIN
EOF
fi

npm install
npm run build
print_status "Frontend built"

# Setup WhatsApp Service
print_status "Setting up WhatsApp Service..."
cd $APP_DIR/whatsapp-service
npm install
print_status "WhatsApp Service configured"

#############################################
# Step 9: Configure Services
#############################################
print_step "Step 9/10: Configuring Services"

# Stop any existing PM2 processes
pm2 delete all 2>/dev/null || true

# Create PM2 ecosystem file
cat > $APP_DIR/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: '/var/www/whatsapp-app/backend',
      script: 'venv/bin/uvicorn',
      args: 'server:app --host 0.0.0.0 --port 8001',
      interpreter: 'none',
      env: {
        PATH: '/var/www/whatsapp-app/backend/venv/bin:' + process.env.PATH
      }
    },
    {
      name: 'whatsapp-service',
      cwd: '/var/www/whatsapp-app/whatsapp-service',
      script: 'index.js',
      interpreter: 'node'
    }
  ]
};
EOF

# Start services with PM2
cd $APP_DIR
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root
print_status "Services started with PM2"

# Configure Nginx
print_status "Configuring Nginx..."

cat > /etc/nginx/sites-available/whatsapp-app << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Frontend
    location / {
        root $APP_DIR/frontend/build;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8001/api/;
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
    }
}
EOF

ln -sf /etc/nginx/sites-available/whatsapp-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
print_status "Nginx configured"

#############################################
# Step 10: Firewall & SSL
#############################################
print_step "Step 10/10: Firewall & SSL Setup"

# Configure Firewall
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable
print_status "Firewall configured"

# Install SSL (only if domain, not IP)
if [[ ! "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_status "Installing SSL Certificate..."
    apt install -y certbot python3-certbot-nginx
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m $EMAIL || print_warning "SSL setup failed - you may need to run certbot manually"
fi

#############################################
# Final Status
#############################################
echo -e "\n${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  🎉 DEPLOYMENT COMPLETE!                                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📊 Service Status:${NC}"
pm2 status

echo -e "\n${BLUE}🌐 Access Your Application:${NC}"
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "   URL: ${GREEN}http://$DOMAIN${NC}"
else
    echo -e "   URL: ${GREEN}https://$DOMAIN${NC}"
fi

echo -e "\n${BLUE}👤 Default Admin Credentials:${NC}"
echo -e "   Email: ${YELLOW}admin@admin.com${NC}"
echo -e "   Password: ${YELLOW}Admin@7501${NC}"

echo -e "\n${BLUE}📝 Useful Commands:${NC}"
echo "   pm2 status          - Check services status"
echo "   pm2 logs            - View all logs"
echo "   pm2 restart all     - Restart all services"
echo "   pm2 logs backend    - View backend logs"

echo -e "\n${YELLOW}⚠️  Important:${NC}"
echo "   1. Change default admin password after first login"
echo "   2. DNS propagation may take 24-48 hours"
echo "   3. If domain shows error, wait and try again"

echo -e "\n${GREEN}✅ Your WhatsApp Automation System is now LIVE!${NC}\n"
