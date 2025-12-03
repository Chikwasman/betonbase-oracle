#!/bin/bash

###############################################################################
# BetOnBase Oracle - Complete VPS Deployment Script
# This script sets up everything needed for production deployment
###############################################################################

set -e  # Exit on any error

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   BetOnBase Oracle - Production VPS Deployment               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-}"  # Optional: your domain for API
PROJECT_DIR="/home/$USER/betonbase-oracle"
SERVICE_NAME="betonbase-oracle"

###############################################################################
# Step 1: System Update
###############################################################################
echo -e "${BLUE}[1/10] Updating system packages...${NC}"
sudo apt update
sudo apt upgrade -y

###############################################################################
# Step 2: Install Node.js
###############################################################################
echo -e "${BLUE}[2/10] Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

###############################################################################
# Step 3: Install Git
###############################################################################
echo -e "${BLUE}[3/10] Installing Git...${NC}"
sudo apt install -y git

###############################################################################
# Step 4: Install PM2
###############################################################################
echo -e "${BLUE}[4/10] Installing PM2 (Process Manager)...${NC}"
sudo npm install -g pm2

###############################################################################
# Step 5: Clone/Setup Project
###############################################################################
echo -e "${BLUE}[5/10] Setting up project...${NC}"

if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}Project directory exists. Pulling latest changes...${NC}"
    cd "$PROJECT_DIR"
    git pull origin main || echo "Using existing code"
else
    echo -e "${YELLOW}Please enter your GitHub repository URL:${NC}"
    read -p "Repository URL: " REPO_URL
    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

###############################################################################
# Step 6: Install Dependencies
###############################################################################
echo -e "${BLUE}[6/10] Installing project dependencies...${NC}"
npm install

###############################################################################
# Step 7: Setup Environment Variables
###############################################################################
echo -e "${BLUE}[7/10] Setting up environment variables...${NC}"

if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    echo "Please provide the following information:"
    
    read -p "Oracle Private Key (0x...): " PRIVATE_KEY
    read -p "API-Football API Key: " API_KEY
    read -p "BetOnBase Contract Address (default: 0xF75dD9a3101040B99FA61708CF1A8038Cce048b5): " CONTRACT_ADDR
    CONTRACT_ADDR=${CONTRACT_ADDR:-0xF75dD9a3101040B99FA61708CF1A8038Cce048b5}
    
    cat > .env << EOF
# Blockchain Configuration
PRIVATE_KEY=$PRIVATE_KEY
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BETONBASE_ADDRESS=$CONTRACT_ADDR

# API-Football Configuration
API_FOOTBALL_KEY=$API_KEY
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io

# Environment
NODE_ENV=production
LOG_LEVEL=info

# API Server Configuration
API_PORT=3001
FRONTEND_URL=*

# Leagues
LEAGUE_EPL=39
LEAGUE_LA_LIGA=140
LEAGUE_SERIE_A=135
LEAGUE_BUNDESLIGA=78
LEAGUE_CHAMPIONS=2
LEAGUE_EUROPA=3

# Timing
MATCH_ADD_DAYS_BEFORE=4
CHECK_INTERVAL_HOURS=6
EOF

    echo -e "${GREEN}✓ Environment file created${NC}"
else
    echo -e "${GREEN}✓ Environment file already exists${NC}"
fi

###############################################################################
# Step 8: Build Project
###############################################################################
echo -e "${BLUE}[8/10] Building project...${NC}"
npm run build

###############################################################################
# Step 9: Setup PM2 Ecosystem
###############################################################################
echo -e "${BLUE}[9/10] Setting up PM2 configuration...${NC}"

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'oracle-service',
      script: './dist/index.js',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/oracle-error.log',
      out_file: './logs/oracle-out.log',
      log_file: './logs/oracle-combined.log',
      time: true
    },
    {
      name: 'api-server',
      script: './dist/api-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true
    }
  ]
};
EOF

echo -e "${GREEN}✓ PM2 configuration created${NC}"

###############################################################################
# Step 10: Start Services
###############################################################################
echo -e "${BLUE}[10/10] Starting services with PM2...${NC}"

# Stop any existing processes
pm2 delete all 2>/dev/null || true

# Start services
pm2 start ecosystem.config.js

# Setup startup script
pm2 startup | tail -n 1 | sudo bash
pm2 save

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Services Status:${NC}"
pm2 status
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  pm2 status                    - Check service status"
echo "  pm2 logs                      - View all logs"
echo "  pm2 logs oracle-service       - View oracle logs"
echo "  pm2 logs api-server           - View API logs"
echo "  pm2 restart all               - Restart all services"
echo "  pm2 monit                     - Real-time monitoring"
echo ""
echo -e "${BLUE}API Endpoints:${NC}"
echo "  http://$(hostname -I | awk '{print $1}'):3001/api/health"
echo "  http://$(hostname -I | awk '{print $1}'):3001/api/matches"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Configure firewall to allow port 3001"
echo "  2. Set up Nginx reverse proxy (optional)"
echo "  3. Configure SSL certificate (optional)"
echo "  4. Set up monitoring dashboard"
echo ""
echo -e "${GREEN}🎉 Your oracle is now running 24/7!${NC}"
