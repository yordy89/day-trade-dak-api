#!/bin/bash

# Script to update existing PM2 configuration for cron jobs
# Run this on your AWS Lightsail server

echo "========================================="
echo "🔧 Updating PM2 Configuration for Cron Jobs"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check current PM2 configuration
echo -e "\n${YELLOW}1. Current PM2 Status:${NC}"
pm2 list

# Get the app name (assuming it's running)
APP_NAME=$(pm2 list | grep "online" | awk '{print $4}' | head -1)
if [ -z "$APP_NAME" ]; then
    APP_NAME="daytradedak-api"  # Default name
    echo -e "${YELLOW}Using default app name: $APP_NAME${NC}"
else
    echo -e "${GREEN}Found running app: $APP_NAME${NC}"
fi

# 2. Check current exec mode
echo -e "\n${YELLOW}2. Checking current exec mode:${NC}"
CURRENT_MODE=$(pm2 describe $APP_NAME | grep "exec mode" | awk '{print $4}')
echo "   Current mode: $CURRENT_MODE"

if [[ "$CURRENT_MODE" == *"cluster"* ]]; then
    echo -e "${RED}⚠️  App is running in CLUSTER mode - needs to be changed to FORK mode${NC}"
    NEEDS_UPDATE=true
else
    echo -e "${GREEN}✅ App is already in FORK mode${NC}"
    NEEDS_UPDATE=false
fi

# 3. Check number of instances
echo -e "\n${YELLOW}3. Checking number of instances:${NC}"
INSTANCE_COUNT=$(pm2 list | grep "$APP_NAME" | wc -l)
echo "   Instance count: $INSTANCE_COUNT"

if [ "$INSTANCE_COUNT" -gt 1 ]; then
    echo -e "${RED}⚠️  Multiple instances detected - needs to be reduced to 1${NC}"
    NEEDS_UPDATE=true
else
    echo -e "${GREEN}✅ Single instance running${NC}"
fi

# 4. Update PM2 configuration if needed
if [ "$NEEDS_UPDATE" = true ]; then
    echo -e "\n${YELLOW}4. Updating PM2 configuration...${NC}"
    
    # Save current environment variables
    echo "   Saving current configuration..."
    pm2 save
    
    # Stop the current app
    echo "   Stopping current app..."
    pm2 stop $APP_NAME
    
    # Delete current app configuration
    echo "   Removing current configuration..."
    pm2 delete $APP_NAME
    
    # Restart with correct configuration
    echo -e "\n${GREEN}5. Starting with correct configuration for cron jobs:${NC}"
    
    # Check if ecosystem file exists
    if [ -f "ecosystem.config.js" ]; then
        echo "   Using ecosystem.config.js"
        pm2 start ecosystem.config.js --env production
    else
        echo "   Starting with manual configuration"
        # Start with fork mode and single instance
        pm2 start dist/main.js \
            --name "$APP_NAME" \
            --instances 1 \
            --exec-mode fork \
            --env NODE_ENV=production \
            --env PORT=3000 \
            --env TZ=America/New_York \
            --max-memory-restart 1G \
            --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
            --merge-logs
    fi
    
    # Save the new configuration
    pm2 save
    
    echo -e "${GREEN}✅ PM2 configuration updated successfully${NC}"
else
    echo -e "\n${GREEN}✅ PM2 configuration is already correct${NC}"
    
    # Just add timezone if not set
    echo -e "\n${YELLOW}5. Setting timezone environment variable:${NC}"
    pm2 set $APP_NAME:TZ America/New_York
    pm2 restart $APP_NAME
fi

# 6. Verify the changes
echo -e "\n${YELLOW}6. Verifying configuration:${NC}"
sleep 2
pm2 describe $APP_NAME | grep -E "(exec mode|instances)"

# 7. Check logs for cron initialization
echo -e "\n${YELLOW}7. Checking for cron initialization:${NC}"
pm2 logs $APP_NAME --nostream --lines 20 | grep -E "(Cron|Schedule|subscription sync)" || echo "   No cron logs yet (app may still be starting)"

echo -e "\n========================================="
echo -e "${GREEN}✅ Configuration Complete!${NC}"
echo "========================================="

echo -e "\n${GREEN}Monitor cron jobs with:${NC}"
echo "   pm2 logs $APP_NAME | grep 'subscription sync'"
echo "   pm2 logs $APP_NAME | grep 'Cron'"

echo -e "\n${GREEN}Check cron status:${NC}"
echo "   curl http://localhost:3000/api/cron/status"

echo -e "\n${GREEN}If you need to restart:${NC}"
echo "   pm2 restart $APP_NAME"

echo -e "\n${YELLOW}IMPORTANT:${NC}"
echo "   - App is now running in FORK mode with 1 instance"
echo "   - Timezone is set to America/New_York"
echo "   - Cron jobs will not duplicate"
echo "   - Monitor first hour to ensure crons execute properly"