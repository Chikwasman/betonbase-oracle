#!/bin/bash

###############################################################################
# Nginx Setup for BetOnBase Oracle API
# Sets up reverse proxy with SSL support
###############################################################################

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   Nginx & SSL Setup for BetOnBase Oracle                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

###############################################################################
# Step 1: Install Nginx
###############################################################################
echo -e "${BLUE}[1/5] Installing Nginx...${NC}"
sudo apt update
sudo apt install -y nginx

###############################################################################
# Step 2: Get Domain/IP
###############################################################################
echo -e "${BLUE}[2/5] Configuration...${NC}"
echo ""
echo "Do you have a domain name? (y/n)"
read -p "> " HAS_DOMAIN

if [ "$HAS_DOMAIN" = "y" ]; then
    read -p "Enter your domain (e.g., api.betonbase.com): " DOMAIN
    USE_SSL=true
else
    DOMAIN=$(hostname -I | awk '{print $1}')
    USE_SSL=false
    echo "Using IP address: $DOMAIN"
fi

###############################################################################
# Step 3: Create Nginx Configuration
###############################################################################
echo -e "${BLUE}[3/5] Creating Nginx configuration...${NC}"

sudo tee /etc/nginx/sites-available/betonbase-api > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/betonbase-api /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

###############################################################################
# Step 4: SSL Setup (if domain provided)
###############################################################################
if [ "$USE_SSL" = true ]; then
    echo -e "${BLUE}[4/5] Setting up SSL with Let's Encrypt...${NC}"
    
    # Install Certbot
    sudo apt install -y certbot python3-certbot-nginx
    
    # Get certificate
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN || {
        echo -e "${YELLOW}SSL setup failed. Continuing with HTTP...${NC}"
    }
else
    echo -e "${YELLOW}[4/5] Skipping SSL (no domain provided)${NC}"
fi

###############################################################################
# Step 5: Start Nginx
###############################################################################
echo -e "${BLUE}[5/5] Starting Nginx...${NC}"
sudo systemctl enable nginx
sudo systemctl restart nginx

###############################################################################
# Configure Firewall
###############################################################################
echo -e "${BLUE}Configuring firewall...${NC}"
sudo ufw allow 'Nginx Full' || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Nginx Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$USE_SSL" = true ]; then
    echo -e "${GREEN}Your API is available at:${NC}"
    echo "  https://$DOMAIN/api/health"
    echo "  https://$DOMAIN/api/matches"
else
    echo -e "${GREEN}Your API is available at:${NC}"
    echo "  http://$DOMAIN/api/health"
    echo "  http://$DOMAIN/api/matches"
fi

echo ""
echo -e "${BLUE}Test your API:${NC}"
if [ "$USE_SSL" = true ]; then
    echo "  curl https://$DOMAIN/api/health"
else
    echo "  curl http://$DOMAIN/api/health"
fi
