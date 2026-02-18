#!/bin/bash

# ===========================================
# BotWave PostgreSQL Database Setup Script
# ===========================================
# Run this script on your VPS to setup PostgreSQL
# Usage: chmod +x setup_postgresql.sh && ./setup_postgresql.sh

set -e

echo "=========================================="
echo "BotWave PostgreSQL Setup Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - CHANGE THESE VALUES
DB_NAME="botwave"
DB_USER="botwave_user"
DB_PASSWORD="BotWave@SecurePass123"  # CHANGE THIS IN PRODUCTION!

echo -e "${YELLOW}Step 1: Installing PostgreSQL...${NC}"
apt-get update
apt-get install -y postgresql postgresql-contrib

echo -e "${YELLOW}Step 2: Starting PostgreSQL service...${NC}"
systemctl start postgresql
systemctl enable postgresql

echo -e "${YELLOW}Step 3: Creating database and user...${NC}"
sudo -u postgres psql << EOSQL
-- Create database
CREATE DATABASE ${DB_NAME};

-- Create user with password
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to botwave database and grant schema privileges
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOSQL

echo -e "${YELLOW}Step 4: Creating tables...${NC}"
sudo -u postgres psql -d ${DB_NAME} << 'EOSQL'

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    plain_password VARCHAR(255),
    api_key VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    rate_limit INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Message logs table
CREATE TABLE IF NOT EXISTS message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_number VARCHAR(50) NOT NULL,
    message_body TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global_settings',
    default_rate_limit INTEGER DEFAULT 30,
    max_rate_limit INTEGER DEFAULT 100,
    enable_registration BOOLEAN DEFAULT TRUE,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_message_logs_user_id ON message_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Grant permissions to botwave_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO botwave_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO botwave_user;

EOSQL

echo -e "${YELLOW}Step 5: Configuring PostgreSQL for remote connections...${NC}"
PG_VERSION=$(ls /etc/postgresql/)
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

# Allow listening on all interfaces
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" ${PG_CONF}

# Add authentication rule for remote connections
echo "host    all             all             0.0.0.0/0               md5" >> ${PG_HBA}

echo -e "${YELLOW}Step 6: Restarting PostgreSQL...${NC}"
systemctl restart postgresql

echo -e "${GREEN}=========================================="
echo "PostgreSQL Setup Complete!"
echo "=========================================="
echo ""
echo "Database: ${DB_NAME}"
echo "User: ${DB_USER}"
echo "Password: ${DB_PASSWORD}"
echo ""
echo "Connection String:"
echo "postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
echo ""
echo "For remote connection (replace YOUR_VPS_IP):"
echo "postgresql://${DB_USER}:${DB_PASSWORD}@YOUR_VPS_IP:5432/${DB_NAME}"
echo ""
echo -e "${YELLOW}IMPORTANT: Update your backend/.env file with the correct DATABASE_URL${NC}"
echo -e "==========================================${NC}"
