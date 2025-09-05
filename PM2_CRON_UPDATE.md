# Quick PM2 Update for Cron Jobs

## Option 1: If you can restart the app

```bash
# SSH to your server
cd /path/to/DayTradeDakApi

# Check current PM2 status
pm2 list

# Stop and delete current instance
pm2 stop all
pm2 delete all

# Start with FORK mode and SINGLE instance
pm2 start dist/main.js \
  --name "daytradedak-api" \
  --instances 1 \
  --exec-mode fork \
  --env NODE_ENV=production \
  --env PORT=3000 \
  --env TZ=America/New_York \
  --max-memory-restart 1G \
  --merge-logs

# Save configuration
pm2 save

# Verify it's running correctly
pm2 status
pm2 describe daytradedak-api | grep "exec mode"
```

## Option 2: If you have ecosystem.config.js

```bash
# Copy the ecosystem.config.js to your server, then:
pm2 stop all
pm2 delete all
pm2 start ecosystem.config.js --env production
pm2 save
```

## Option 3: Without restarting (risky for crons)

If you absolutely cannot restart, you can try scaling down:

```bash
# Scale down to 1 instance (if currently using multiple)
pm2 scale daytradedak-api 1

# But this won't change from cluster to fork mode
# Crons might still duplicate if in cluster mode
```

## ⚠️ IMPORTANT CHECKS

### 1. Verify Fork Mode
```bash
pm2 describe daytradedak-api | grep "exec mode"
# Should show: │ exec mode      │ fork │
# NOT: │ exec mode      │ cluster │
```

### 2. Verify Single Instance
```bash
pm2 list
# Should show only 1 instance of daytradedak-api
```

### 3. Verify Timezone
```bash
pm2 describe daytradedak-api | grep TZ
# Should show: │ TZ             │ America/New_York │
```

## 🔍 Test Cron Status

After updating, test that crons are working:

```bash
# Check cron status endpoint
curl http://localhost:3000/api/cron/status

# Watch logs for cron execution
pm2 logs daytradedak-api | grep -E "(Cron|subscription sync)"

# The hourly cron should run within an hour
# Look for: "🔍 Running hourly subscription sync check..."
```

## 📊 What Each Setting Does

- **`--instances 1`**: Only 1 copy of your app (prevents duplicate cron executions)
- **`--exec-mode fork`**: Fork mode (required for cron jobs, cluster mode breaks them)
- **`--env TZ=America/New_York`**: Sets timezone for consistent cron scheduling
- **`--max-memory-restart 1G`**: Auto-restart if memory exceeds 1GB
- **`--merge-logs`**: Combines stdout and stderr for easier debugging

## 🚨 Common Issues

### Issue: "Cannot restart in fork mode"
**Solution**: You must delete and recreate the PM2 process

### Issue: Crons running multiple times
**Cause**: Multiple instances or cluster mode
**Solution**: Ensure single instance in fork mode

### Issue: Crons running at wrong time
**Cause**: Timezone not set
**Solution**: Add TZ environment variable

## 📝 Full Command with All Options

```bash
pm2 start dist/main.js \
  --name "daytradedak-api" \
  --instances 1 \
  --exec-mode fork \
  --env NODE_ENV=production \
  --env PORT=3000 \
  --env TZ=America/New_York \
  --env FORCE_COLOR=1 \
  --max-memory-restart 1G \
  --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
  --merge-logs \
  --time
```