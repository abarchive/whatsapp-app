# 🚀 WhatsApp Automation - Hostinger KVM 2 Deployment Guide

## 📋 Prerequisites

- **Server:** Hostinger KVM 2 with Ubuntu 22.04/24.04
- **Domain:** (Optional) Point your domain to server IP
- **SSH Access:** Root access to your VPS

---

## 🔧 Quick Deployment Steps

### Step 1: Connect to Server
```bash
ssh root@YOUR_SERVER_IP
```

### Step 2: Download Application
```bash
# Create directory
mkdir -p /root/whatsapp-app
cd /root/whatsapp-app

# Option A: From GitHub (after saving to GitHub)
git clone YOUR_GITHUB_REPO_URL .

# Option B: Upload files via SFTP/SCP
# Use FileZilla or similar to upload:
#   - backend/
#   - frontend/
#   - whatsapp-service/
#   - db_backup/
#   - deploy.sh
```

### Step 3: Run Deployment Script
```bash
cd /root/whatsapp-app
chmod +x deploy.sh
sudo bash deploy.sh
```

### Step 4: Follow On-Screen Prompts
- Enter your domain/IP
- Enter your email (for SSL)
- Wait for installation (10-15 minutes)

---

## 📁 Required Files Structure

```
/root/whatsapp-app/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── .env (created by script)
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env (created by script)
├── whatsapp-service/
│   ├── index.js
│   └── package.json
├── db_backup/           # Optional - for data migration
│   ├── users.json
│   ├── message_logs.json
│   ├── settings.json
│   └── activity_logs.json
├── deploy.sh
└── import_data.sh
```

---

## 🔑 Default Credentials

After deployment:
- **URL:** http://YOUR_IP or https://YOUR_DOMAIN
- **Admin Email:** admin@admin.com
- **Admin Password:** Admin@7501

⚠️ **Change admin password after first login!**

---

## 📝 Useful Commands

```bash
# Check service status
pm2 status

# View logs
pm2 logs
pm2 logs backend
pm2 logs whatsapp-service

# Restart services
pm2 restart all
pm2 restart backend
pm2 restart whatsapp-service

# Real-time monitoring
pm2 monit

# Check MongoDB
sudo systemctl status mongod

# Check Nginx
sudo systemctl status nginx
sudo nginx -t  # Test config

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🔧 Troubleshooting

### Issue: Services not starting
```bash
# Check logs
pm2 logs

# Restart services
pm2 restart all

# Check if ports are in use
sudo lsof -i :8001
sudo lsof -i :8002
```

### Issue: WhatsApp QR not showing
```bash
# Check WhatsApp service logs
pm2 logs whatsapp-service

# Check Chromium
which chromium-browser || which chromium

# Restart WhatsApp service
pm2 restart whatsapp-service
```

### Issue: Cannot access website
```bash
# Check Nginx
sudo nginx -t
sudo systemctl restart nginx

# Check firewall
sudo ufw status

# Allow ports
sudo ufw allow 80
sudo ufw allow 443
```

### Issue: MongoDB connection error
```bash
# Check MongoDB status
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

### Issue: SSL Certificate failed
```bash
# Manually run certbot
sudo certbot --nginx -d yourdomain.com

# Renew certificate
sudo certbot renew
```

---

## 🔄 Update Application

```bash
# Stop services
pm2 stop all

# Pull latest code (if using Git)
cd /var/www/whatsapp-app
git pull origin main

# Or upload new files via SFTP

# Rebuild frontend
cd frontend
npm run build

# Restart services
pm2 restart all
```

---

## 📊 Data Migration

If you have backup data from preview environment:

```bash
# Copy db_backup folder to server
cd /var/www/whatsapp-app

# Run import script
chmod +x import_data.sh
./import_data.sh db_backup/
```

---

## ⚙️ Configuration Files

### Backend .env (`/var/www/whatsapp-app/backend/.env`)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=whatsapp_automation
JWT_SECRET=your-secure-jwt-secret
WHATSAPP_SERVICE_URL=http://localhost:8002
CORS_ORIGINS=*
```

### Frontend .env (`/var/www/whatsapp-app/frontend/.env`)
```env
REACT_APP_BACKEND_URL=https://yourdomain.com
```

### PM2 Ecosystem (`/var/www/whatsapp-app/ecosystem.config.js`)
```javascript
module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: '/var/www/whatsapp-app/backend',
      script: './venv/bin/python',
      args: '-m uvicorn server:app --host 0.0.0.0 --port 8001'
    },
    {
      name: 'whatsapp-service',
      cwd: '/var/www/whatsapp-app/whatsapp-service',
      script: 'index.js'
    }
  ]
};
```

---

## 🆘 Support

If you face any issues:
1. Check logs: `pm2 logs`
2. Check deployment log: `cat /var/log/whatsapp-deploy.log`
3. Restart services: `pm2 restart all`

---

## ✅ Post-Deployment Checklist

- [ ] Can access website at domain/IP
- [ ] Can login with admin credentials
- [ ] Admin panel is accessible
- [ ] WhatsApp QR code appears when clicking "Connect"
- [ ] SSL certificate working (if using domain)
- [ ] Changed default admin password
