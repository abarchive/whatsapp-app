#!/bin/bash

#############################################
# 📦 Database Import Script
# Imports backup data into MongoDB
#############################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📦 WhatsApp Automation - Database Import${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

DB_NAME="whatsapp_automation"
BACKUP_DIR="${1:-./db_backup}"

if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}[✗] Backup directory not found: $BACKUP_DIR${NC}"
    echo "Usage: ./import_data.sh [backup_directory]"
    exit 1
fi

echo -e "${YELLOW}Importing from: $BACKUP_DIR${NC}\n"

# Check MongoDB is running
if ! mongosh --eval "db.runCommand({ping:1})" &>/dev/null; then
    echo -e "${RED}[✗] MongoDB is not running!${NC}"
    echo "Start MongoDB: sudo systemctl start mongod"
    exit 1
fi

# Import each collection
for file in "$BACKUP_DIR"/*.json; do
    if [ -f "$file" ]; then
        collection=$(basename "$file" .json)
        echo -n "Importing $collection... "
        
        if mongoimport --db "$DB_NAME" --collection "$collection" --file "$file" --jsonArray --drop &>/dev/null; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
        fi
    fi
done

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Database import complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Show counts
echo -e "${YELLOW}Collection counts:${NC}"
mongosh --quiet "$DB_NAME" --eval "
db.getCollectionNames().forEach(function(c) {
    print('  ' + c + ': ' + db[c].countDocuments());
});
"
