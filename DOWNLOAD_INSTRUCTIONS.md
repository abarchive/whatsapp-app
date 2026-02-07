# 📥 Quick Download Instructions

## VPS पर पहली बार Login करने के बाद:

### Step 1: Project Files Download करें

आपको पहले इस Emergent project को download करना होगा। यह कई तरीकों से हो सकता है:

---

## Option A: GitHub से (Recommended)

1. **पहले GitHub पर repository बनाएं:**
   - Emergent platform पर "Save to GitHub" button click करें
   - या manually GitHub पर new repository बनाएं

2. **VPS पर clone करें:**
```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git whatsapp-app
cd whatsapp-app
chmod +x deploy.sh
./deploy.sh
```

---

## Option B: Direct Upload (FileZilla से)

1. **FileZilla Download करें:** https://filezilla-project.org/

2. **Connect करें:**
   - Host: `sftp://YOUR_VPS_IP`
   - Username: `root`
   - Password: `your_password`
   - Port: `22`

3. **Upload करें:**
   - Local में अपने downloaded project folder select करें
   - Remote में `/var/www/whatsapp-app/` folder बनाएं
   - सभी files upload करें

4. **Deploy Script Run करें:**
```bash
cd /var/www/whatsapp-app
chmod +x deploy.sh
./deploy.sh
```

---

## Option C: Emergent से Direct Download

1. **Emergent Platform पर:**
   - "Download Code" button click करें
   - ZIP file download होगी

2. **ZIP को VPS पर Upload करें:**
```bash
# VPS पर:
mkdir -p /var/www/whatsapp-app
cd /var/www/whatsapp-app

# FileZilla से ZIP upload करें, फिर:
unzip your-downloaded-file.zip
chmod +x deploy.sh
./deploy.sh
```

---

## 🆘 Help चाहिए?

अगर कोई step समझ नहीं आया:
1. Screenshot लें
2. Error message copy करें
3. Developer से contact करें

---

## 📋 Checklist

- [ ] Hostinger VPS खरीदा (KVM 2 - 4GB RAM)
- [ ] Ubuntu 22.04 select किया
- [ ] VPS IP address नोट किया
- [ ] Domain DNS configured किया (optional)
- [ ] SSH से VPS में login किया
- [ ] Project files upload किए
- [ ] deploy.sh script run किया
- [ ] Website live है!
