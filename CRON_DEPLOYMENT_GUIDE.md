# Cron Jobs Deployment Guide for AWS Lightsail with PM2

## 🚀 Quick Deployment Steps

### 1. Build the Application
```bash
cd /path/to/DayTradeDakApi
npm run build
```

### 2. Deploy with PM2 (IMPORTANT: Single Instance for Crons)
```bash
# Stop existing processes
pm2 stop all
pm2 delete all

# Start with ecosystem config (single instance for cron jobs)
pm2 start ecosystem.config.js --env production

# Save PM2 config for auto-restart
pm2 save
pm2 startup
```

### 3. Verify Deployment
```bash
# Run the verification script
./scripts/verify-cron-deployment.sh

# Check PM2 status
pm2 status

# Monitor logs for cron execution
pm2 logs daytradedak-api --lines 100
```

## ⚠️ Critical Configuration Points

### PM2 Configuration Requirements
1. **MUST use `fork` mode** (not cluster) - Prevents duplicate cron executions
2. **MUST use single instance** (`instances: 1`) - Ensures crons run only once
3. **Set timezone** in environment variables for consistent cron timing

### Environment Variables
```bash
# Add to your .env file
NODE_ENV=production
TZ=America/New_York  # Set your timezone
```

## 📊 Monitoring Cron Jobs

### 1. Check Cron Status via API
```bash
# Get cron status
curl http://your-server:3000/api/cron/status

# Test cron connectivity
curl http://your-server:3000/api/cron/test
```

### 2. Manually Trigger Sync (for testing)
```bash
# Trigger daily sync manually (requires auth)
curl -X POST http://your-server:3000/api/cron/trigger-sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Trigger hourly sync manually
curl -X POST http://your-server:3000/api/cron/trigger-hourly \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Monitor Logs
```bash
# Watch for subscription sync logs
pm2 logs daytradedak-api | grep -E "(subscription sync|Daily|Hourly|Cron)"

# Check for errors
pm2 logs daytradedak-api --err

# See recent cron executions
pm2 logs daytradedak-api | grep "📊"
```

## 🕐 Cron Schedule

| Job Name | Schedule | Description |
|----------|----------|-------------|
| Daily Sync | `0 0 * * *` | Runs at midnight - Full subscription sync with Stripe |
| Hourly Check | Every hour | Verifies recent transactions and fixes missed updates |

## 🔍 Troubleshooting

### Problem: Crons not running
**Solution:**
1. Check PM2 is in fork mode: `pm2 describe daytradedak-api`
2. Verify single instance: `pm2 list`
3. Check logs: `pm2 logs daytradedak-api --lines 200`

### Problem: Duplicate cron executions
**Solution:**
1. Ensure only 1 PM2 instance is running
2. Check for multiple Node processes: `ps aux | grep node`
3. Restart with ecosystem config: `pm2 restart ecosystem.config.js`

### Problem: Wrong timezone
**Solution:**
1. Set TZ environment variable in ecosystem.config.js
2. Restart PM2: `pm2 restart daytradedak-api`
3. Verify: `pm2 describe daytradedak-api | grep TZ`

### Problem: Memory issues
**Solution:**
1. Check memory: `pm2 monit`
2. Increase memory limit in ecosystem.config.js
3. Enable auto-restart on memory limit: `max_memory_restart: '1G'`

## 📝 Logs Location

- PM2 logs: `~/.pm2/logs/`
- Application logs: `logs/` (configured in ecosystem.config.js)
- Combined log: `logs/combined.log`
- Error log: `logs/err.log`
- Output log: `logs/out.log`

## 🔄 Auto-restart on Server Reboot

```bash
# Generate startup script
pm2 startup

# Follow the instructions provided, usually:
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Save current PM2 list
pm2 save
```

## ✅ Verification Checklist

- [ ] PM2 running in **fork mode** (not cluster)
- [ ] Only **1 instance** running
- [ ] Timezone configured correctly
- [ ] Cron status endpoint responding
- [ ] Logs showing cron initialization
- [ ] No duplicate Node processes
- [ ] Auto-restart configured

## 📞 Support Commands

```bash
# Full system check
./scripts/verify-cron-deployment.sh

# PM2 commands
pm2 status          # Check status
pm2 logs            # View logs
pm2 monit           # Monitor resources
pm2 restart all     # Restart application
pm2 reload all      # Graceful reload

# Test endpoints
curl http://localhost:3000/api/cron/status
curl http://localhost:3000/api/cron/test
```

## 🎯 Expected Log Output

When working correctly, you should see:

```
[SubscriptionSyncCron] 🔄 Starting daily subscription sync...
[SubscriptionSyncCron] 📊 Found X subscription payments from last 24 hours
[SubscriptionSyncCron] ✅ Daily subscription sync completed

[SubscriptionSyncCron] 🔍 Running hourly subscription sync check...
[SubscriptionSyncCron] Found X recent transactions to verify
```

## 🚨 Important Notes

1. **Never run multiple instances** when using cron jobs
2. **Always use fork mode** in PM2 for cron jobs
3. **Monitor first 24 hours** after deployment to ensure crons run correctly
4. **Keep logs** for at least 7 days for debugging
5. **Set up alerts** for failed cron executions if possible