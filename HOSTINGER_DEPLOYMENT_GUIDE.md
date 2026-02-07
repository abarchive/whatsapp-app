# 🚀 Hostinger VPS Deployment Guide - WhatsApp Automation System

## 📋 Prerequisites (पहले यह करें)

### Step 1: Hostinger VPS खरीदें
1. जाएं: https://www.hostinger.in/vps-hosting
2. **KVM 2** plan select करें (4GB RAM - ₹519/month)
3. **Ubuntu 22.04** Operating System चुनें
4. Payment करें और VPS activate होने का wait करें (5-10 minutes)

### Step 2: Domain Connect करें (Optional but Recommended)
1. Hostinger panel में जाएं
2. **DNS Zone** में जाकर A Record add करें:
   - Name: `@` या `api`
   - Points to: `Your VPS IP Address`
   - TTL: 14400

### Step 3: VPS Access Details नोट करें
Hostinger panel से यह details नोट करें:
- **IP Address**: xxx.xxx.xxx.xxx
- **Username**: root
- **Password**: (जो आपने set किया)

---

## 🖥️ VPS में Login करें

### Windows Users:
1. **PuTTY** download करें: https://putty.org
2. PuTTY खोलें
3. Host Name में अपना **VPS IP** डालें
4. Port: **22**
5. **Open** click करें
6. Username: `root` और Password डालें

### Mac/Linux Users:
Terminal खोलें और type करें:
```bash
ssh root@YOUR_VPS_IP
```

---

## 🔧 One-Click Deployment (आसान तरीका)

एक बार login करने के बाद, बस यह एक command run करें:

```bash
curl -fsSL https://raw.githubusercontent.com/your-repo/deploy.sh | bash
```

**या** नीचे दिया गया script manually copy-paste करें:

```bash
wget -O deploy.sh https://your-domain.com/deploy.sh && chmod +x deploy.sh && ./deploy.sh
```

---

## 📝 Manual Step-by-Step Installation

अगर one-click script काम न करे, तो यह steps follow करें:

### Step 1: System Update करें
```bash
apt update && apt upgrade -y
```

### Step 2: Required Software Install करें
```bash
# Basic tools
apt install -y curl wget git unzip nano ufw

# Node.js 20 Install
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Python 3.11 Install
apt install -y python3 python3-pip python3-venv

# MongoDB Install
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# Chromium Install (WhatsApp के लिए जरूरी)
apt install -y chromium-browser || apt install -y chromium

# Nginx Install
apt install -y nginx

# PM2 Install (Process Manager)
npm install -g pm2
```

### Step 3: Firewall Setup करें
```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable
```

### Step 4: Project Files Upload करें

**Option A: GitHub से (Recommended)**
```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git whatsapp-app
cd whatsapp-app
```

**Option B: Local से Upload (FileZilla से)**
1. FileZilla download करें
2. Connect करें:
   - Host: Your VPS IP
   - Username: root
   - Password: Your Password
   - Port: 22
3. Files को `/var/www/whatsapp-app/` में upload करें

### Step 5: Backend Setup करें
```bash
cd /var/www/whatsapp-app/backend

# Virtual Environment बनाएं
python3 -m venv venv
source venv/bin/activate

# Dependencies Install करें
pip install -r requirements.txt

# Environment File बनाएं
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=whatsapp_automation
JWT_SECRET=your-super-secret-key-change-this-to-random-string
JWT_ALGORITHM=HS256
WHATSAPP_SERVICE_URL=http://localhost:8002
EOF
```

### Step 6: Frontend Setup करें
```bash
cd /var/www/whatsapp-app/frontend

# Dependencies Install करें
npm install

# Environment File बनाएं
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=https://yourdomain.com
EOF

# Production Build बनाएं
npm run build
```

### Step 7: WhatsApp Service Setup करें
```bash
cd /var/www/whatsapp-app/whatsapp-service

# Dependencies Install करें
npm install
```

### Step 8: PM2 से Services Start करें
```bash
cd /var/www/whatsapp-app

# Backend Start करें
pm2 start "cd /var/www/whatsapp-app/backend && source venv/bin/activate && uvicorn server:app --host 0.0.0.0 --port 8001" --name backend

# WhatsApp Service Start करें
pm2 start /var/www/whatsapp-app/whatsapp-service/index.js --name whatsapp-service

# PM2 Startup (Auto-restart on reboot)
pm2 startup
pm2 save
```

### Step 9: Nginx Configure करें
```bash
cat > /etc/nginx/sites-available/whatsapp-app << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend (React Build)
    location / {
        root /var/www/whatsapp-app/frontend/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# Enable Site
ln -sf /etc/nginx/sites-available/whatsapp-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test & Restart Nginx
nginx -t && systemctl restart nginx
```

### Step 10: SSL Certificate Install करें (HTTPS)
```bash
# Certbot Install करें
apt install -y certbot python3-certbot-nginx

# SSL Certificate लें (अपना domain डालें)
certbot --nginx -d yourdomain.com -d www.yourdomain.com --non-interactive --agree-tos -m your@email.com
```

---

## ✅ Verification (Check करें सब काम कर रहा है)

```bash
# Services Status Check करें
pm2 status

# MongoDB Check करें
systemctl status mongod

# Nginx Check करें
systemctl status nginx

# Logs देखें
pm2 logs
```

---

## 🔄 Useful Commands

### Services Restart करें:
```bash
pm2 restart all
```

### Logs देखें:
```bash
pm2 logs backend
pm2 logs whatsapp-service
```

### Services Stop करें:
```bash
pm2 stop all
```

### Update करें (नया code deploy):
```bash
cd /var/www/whatsapp-app
git pull origin main
cd frontend && npm install && npm run build
cd ../backend && source venv/bin/activate && pip install -r requirements.txt
pm2 restart all
```

---

## ⚠️ Important Notes

1. **Domain DNS**: DNS propagation में 24-48 hours लग सकते हैं
2. **WhatsApp Session**: Server restart पर QR फिर से scan करना पड़ सकता है
3. **Backup**: Regular database backup लें:
   ```bash
   mongodump --db whatsapp_automation --out /backup/$(date +%Y%m%d)
   ```
4. **Security**: 
   - JWT_SECRET को strong random string में बदलें
   - Regular system updates करें: `apt update && apt upgrade -y`

---

## 🆘 Troubleshooting

### Problem: Site नहीं खुल रही
```bash
# Nginx logs check करें
tail -f /var/log/nginx/error.log

# Services check करें
pm2 status
```

### Problem: API Error आ रही है
```bash
# Backend logs check करें
pm2 logs backend
```

### Problem: WhatsApp Connect नहीं हो रहा
```bash
# WhatsApp service logs check करें
pm2 logs whatsapp-service

# Chromium check करें
which chromium || which chromium-browser
```

### Problem: MongoDB Connection Error
```bash
# MongoDB status check करें
systemctl status mongod

# MongoDB restart करें
systemctl restart mongod
```

---

## 📞 Support

अगर कोई problem आए तो:
1. Error message screenshot लें
2. `pm2 logs` का output save करें
3. Developer से contact करें

---

**🎉 Congratulations! आपका WhatsApp Automation System Live है!**
