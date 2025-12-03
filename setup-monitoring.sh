#!/bin/bash

###############################################################################
# Monitoring Dashboard Setup for BetOnBase Oracle
# Sets up PM2 monitoring and custom dashboard
###############################################################################

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   BetOnBase Oracle - Monitoring Dashboard Setup              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

###############################################################################
# Option 1: PM2 Plus (Free Cloud Monitoring)
###############################################################################
echo -e "${BLUE}Setting up PM2 Plus monitoring...${NC}"
echo ""
echo "PM2 Plus provides:"
echo "  ✓ Real-time monitoring dashboard"
echo "  ✓ Performance metrics"
echo "  ✓ Error tracking"
echo "  ✓ Email/Slack alerts"
echo ""
echo "Visit: https://app.pm2.io to create a free account"
echo ""
read -p "Do you have a PM2 Plus account? (y/n): " HAS_PM2_ACCOUNT

if [ "$HAS_PM2_ACCOUNT" = "y" ]; then
    echo ""
    echo "Follow these steps:"
    echo "1. Go to https://app.pm2.io"
    echo "2. Create a bucket/server"
    echo "3. Copy the connection command (looks like: pm2 link xxx yyy)"
    echo ""
    read -p "Paste your PM2 link command here: " PM2_LINK_CMD
    
    eval "$PM2_LINK_CMD"
    
    echo -e "${GREEN}✓ Connected to PM2 Plus!${NC}"
    echo "View your dashboard at: https://app.pm2.io"
else
    echo -e "${YELLOW}Skipping PM2 Plus setup${NC}"
fi

###############################################################################
# Option 2: Install PM2 Web Dashboard
###############################################################################
echo ""
echo -e "${BLUE}Installing PM2 Web Interface...${NC}"
sudo npm install -g pm2-gui

echo ""
echo -e "${GREEN}✓ PM2 Web Interface installed${NC}"
echo "Start with: pm2-gui start"
echo "Access at: http://localhost:8088"

###############################################################################
# Option 3: Create Status Endpoint
###############################################################################
echo ""
echo -e "${BLUE}Creating custom status endpoint...${NC}"

# This will be added to your api-server.ts
cat > /tmp/monitoring-snippet.ts << 'EOF'
/**
 * GET /api/status
 * Returns oracle and API server status
 */
app.get('/api/status', async (req, res) => {
  try {
    const blockchain = new BlockchainService();
    const db = new Database();
    
    // Get oracle status
    const balance = await blockchain.getBalance();
    const isAuthorized = await blockchain.verifyOracle();
    const stats = db.getStats();
    
    // Get system info
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    res.json({
      success: true,
      status: 'operational',
      oracle: {
        authorized: isAuthorized,
        balance: balance,
        wallet: process.env.ORACLE_WALLET_ADDRESS,
      },
      database: {
        totalMatches: stats.total,
        upcomingMatches: stats.byStatus.added || 0,
        settledMatches: stats.byStatus.settled || 0,
      },
      system: {
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        memory: `${Math.round(memory.heapUsed / 1024 / 1024)}MB / ${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
        nodeVersion: process.version,
      },
      lastUpdate: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message,
    });
  }
});
EOF

echo -e "${GREEN}✓ Status endpoint code created in /tmp/monitoring-snippet.ts${NC}"
echo "Add this to your api-server.ts file"

###############################################################################
# Setup Automated Alerts
###############################################################################
echo ""
echo -e "${BLUE}Setting up automated health checks...${NC}"

# Create monitoring script
cat > ~/betonbase-oracle/monitor.sh << 'EOF'
#!/bin/bash

# Monitor BetOnBase Oracle Health
LOG_FILE="$HOME/betonbase-oracle/logs/monitor.log"
API_URL="http://localhost:3001/api/health"

# Function to send alert (customize this)
send_alert() {
    local message="$1"
    echo "[$(date)] ALERT: $message" >> "$LOG_FILE"
    
    # Add your alert method here:
    # - Send email
    # - Post to Discord webhook
    # - Send SMS via Twilio
    # Example Discord webhook:
    # curl -X POST "$DISCORD_WEBHOOK" -H 'Content-Type: application/json' -d "{\"content\": \"$message\"}"
}

# Check API health
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" || echo "000")

if [ "$response" != "200" ]; then
    send_alert "API Server is down! HTTP Status: $response"
    pm2 restart api-server
fi

# Check oracle service
if ! pm2 describe oracle-service > /dev/null 2>&1; then
    send_alert "Oracle service is not running!"
    cd ~/betonbase-oracle && pm2 start ecosystem.config.js --only oracle-service
fi

# Check wallet balance
# Add your balance check logic here

echo "[$(date)] Health check completed" >> "$LOG_FILE"
EOF

chmod +x ~/betonbase-oracle/monitor.sh

# Add to crontab (runs every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * $HOME/betonbase-oracle/monitor.sh") | crontab -

echo -e "${GREEN}✓ Health check monitoring enabled (runs every 5 minutes)${NC}"

###############################################################################
# Summary
###############################################################################
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Monitoring Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Available Monitoring Tools:${NC}"
echo ""
echo "1. PM2 Built-in:"
echo "   pm2 monit                - Real-time monitoring"
echo "   pm2 status               - Process status"
echo "   pm2 logs                 - View logs"
echo ""
echo "2. PM2 Plus Dashboard:"
echo "   https://app.pm2.io       - Cloud monitoring"
echo ""
echo "3. PM2 Web Interface:"
echo "   pm2-gui start            - Start web interface"
echo "   http://localhost:8088    - Access dashboard"
echo ""
echo "4. Custom Status Endpoint:"
echo "   http://your-server/api/status  - Oracle status"
echo ""
echo "5. Automated Health Checks:"
echo "   ~/betonbase-oracle/logs/monitor.log  - Check logs"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Add /api/status endpoint code to api-server.ts"
echo "2. Configure alert webhooks in monitor.sh"
echo "3. Set up PM2 Plus account for cloud monitoring"
echo "4. Test all monitoring endpoints"
