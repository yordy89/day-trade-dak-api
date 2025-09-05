#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "🔍 Verifying Cron Job Deployment"
echo "========================================="

# 1. Check if PM2 is running with single instance
echo -e "\n${YELLOW}1. Checking PM2 configuration...${NC}"
PM2_INSTANCES=$(pm2 describe daytradedak-api | grep "exec mode" | awk '{print $4}')
PM2_RUNNING=$(pm2 list | grep "daytradedak-api" | grep "online")

if [ -z "$PM2_RUNNING" ]; then
    echo -e "${RED}❌ PM2 process not running!${NC}"
    echo "   Run: pm2 start ecosystem.config.js --env production"
else
    echo -e "${GREEN}✅ PM2 process is running${NC}"
    
    # Check if running in fork mode (required for cron)
    if [[ "$PM2_INSTANCES" == *"fork"* ]]; then
        echo -e "${GREEN}✅ Running in fork mode (correct for cron jobs)${NC}"
    else
        echo -e "${RED}❌ Not running in fork mode! Cron jobs may duplicate.${NC}"
        echo "   Fix: pm2 delete daytradedak-api && pm2 start ecosystem.config.js --env production"
    fi
fi

# 2. Check Node.js timezone
echo -e "\n${YELLOW}2. Checking timezone configuration...${NC}"
NODE_TZ=$(pm2 describe daytradedak-api | grep "TZ" | awk '{print $3}')
SYSTEM_TZ=$(date +%Z)

echo "   System timezone: $SYSTEM_TZ"
if [ -z "$NODE_TZ" ]; then
    echo -e "${YELLOW}⚠️  No TZ environment variable set in PM2${NC}"
    echo "   Cron will use system timezone: $SYSTEM_TZ"
else
    echo -e "${GREEN}✅ PM2 TZ set to: $NODE_TZ${NC}"
fi

# 3. Check if cron module is loaded
echo -e "\n${YELLOW}3. Checking if cron jobs are registered...${NC}"

# Look for cron job initialization in logs
CRON_LOGS=$(pm2 logs daytradedak-api --nostream --lines 100 | grep -E "(ScheduleModule|CronModule|subscription sync|Cron)" | tail -5)

if [ -z "$CRON_LOGS" ]; then
    echo -e "${YELLOW}⚠️  No cron-related logs found in last 100 lines${NC}"
    echo "   This might be normal if the app just started."
else
    echo -e "${GREEN}✅ Found cron-related logs:${NC}"
    echo "$CRON_LOGS"
fi

# 4. Check memory usage
echo -e "\n${YELLOW}4. Checking memory usage...${NC}"
PM2_MEMORY=$(pm2 describe daytradedak-api | grep "memory" | head -1 | awk '{print $3}')
echo "   Current memory usage: $PM2_MEMORY"

# 5. Test cron execution (optional - requires API endpoint)
echo -e "\n${YELLOW}5. Testing cron status endpoint...${NC}"
API_URL="http://localhost:3000/api/cron/status"
CRON_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_URL 2>/dev/null)

if [ "$CRON_STATUS" == "200" ]; then
    echo -e "${GREEN}✅ Cron status endpoint is responding${NC}"
    curl -s $API_URL | jq '.' 2>/dev/null || curl -s $API_URL
elif [ "$CRON_STATUS" == "404" ]; then
    echo -e "${YELLOW}⚠️  Cron status endpoint not found (this is OK if not implemented)${NC}"
else
    echo -e "${YELLOW}⚠️  Could not reach API (status: $CRON_STATUS)${NC}"
fi

# 6. Check for duplicate processes
echo -e "\n${YELLOW}6. Checking for duplicate processes...${NC}"
NODE_PROCESSES=$(ps aux | grep "[n]ode.*main.js" | wc -l)

if [ "$NODE_PROCESSES" -gt 1 ]; then
    echo -e "${RED}❌ Multiple Node.js processes detected! This may cause duplicate cron executions.${NC}"
    echo "   Processes found: $NODE_PROCESSES"
    ps aux | grep "[n]ode.*main.js"
else
    echo -e "${GREEN}✅ Single Node.js process running${NC}"
fi

# 7. Check MongoDB connectivity (for cron jobs to work)
echo -e "\n${YELLOW}7. Checking database connectivity...${NC}"
DB_CHECK=$(pm2 logs daytradedak-api --nostream --lines 50 | grep -E "(MongoDB|Database connected|Mongoose)" | tail -1)

if [[ "$DB_CHECK" == *"connected"* ]] || [[ "$DB_CHECK" == *"Connected"* ]]; then
    echo -e "${GREEN}✅ Database connection confirmed${NC}"
else
    echo -e "${YELLOW}⚠️  Could not confirm database connection from logs${NC}"
fi

echo -e "\n========================================="
echo "📊 Summary"
echo "========================================="

# Final recommendations
echo -e "\n${GREEN}Recommended PM2 commands:${NC}"
echo "  Start:   pm2 start ecosystem.config.js --env production"
echo "  Restart: pm2 restart daytradedak-api"
echo "  Logs:    pm2 logs daytradedak-api --lines 100"
echo "  Monitor: pm2 monit"

echo -e "\n${GREEN}To monitor cron executions:${NC}"
echo "  pm2 logs daytradedak-api | grep -E '(subscription sync|Cron|Daily|Hourly)'"

echo -e "\n${GREEN}To test subscription sync manually:${NC}"
echo "  curl -X POST http://localhost:3000/api/cron/trigger-sync"

echo -e "\n✅ Deployment verification complete!"