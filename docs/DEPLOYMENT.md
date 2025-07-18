# DayTradeDak API Deployment Guide

This guide covers the deployment process for the DayTradeDak API with all optimization features enabled.

## Prerequisites

### System Requirements
- Node.js 18.x or higher
- MongoDB 5.0 or higher
- Redis 6.2 or higher
- PM2 (for process management)
- Nginx (for reverse proxy)

### Environment Setup
1. Clone the repository
2. Copy `.env.example` to `.env` and configure all required values
3. Install dependencies: `npm install`
4. Build the application: `npm run build`

## Pre-deployment Checklist

### 1. Database Optimization
Run the index creation script to optimize database queries:
```bash
npm run create-indexes
```

### 2. Redis Setup
Ensure Redis is installed and running:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify Redis is running
redis-cli ping
```

### 3. Environment Variables
Verify all required environment variables are set:
```bash
# Check environment variables
node -e "require('dotenv').config(); console.log('Mongo URI:', !!process.env.MONGO_URI); console.log('AWS configured:', !!process.env.AWS_ACCESS_KEY_ID);"
```

## Deployment Steps

### 1. Install Dependencies
```bash
npm ci --only=production
```

### 2. Build the Application
```bash
npm run build
```

### 3. Run Database Migrations
```bash
npm run migrate:prod
```

### 4. Start with PM2
Create a PM2 ecosystem file:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'daytradedak-api',
    script: './dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    exp_backoff_restart_delay: 100
  }]
};
```

Start the application:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Configure Nginx
Create Nginx configuration:

```nginx
# /etc/nginx/sites-available/daytradedak-api
upstream daytradedak_api {
    least_conn;
    server localhost:4000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.daytradedak.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.daytradedak.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.daytradedak.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.daytradedak.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Request size limits
    client_max_body_size 10M;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # API endpoints
    location /api {
        proxy_pass http://daytradedak_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Enable request buffering for Stripe webhooks
        proxy_request_buffering off;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://daytradedak_api/health;
        access_log off;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/daytradedak-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL Setup with Let's Encrypt
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d api.daytradedak.com
```

## Performance Optimization

### 1. MongoDB Connection Pooling
The application is configured with connection pooling. Verify settings in `.env`:
```
DB_POOL_SIZE=10
```

### 2. Redis Cache Configuration
Ensure Redis persistence is configured:
```bash
# /etc/redis/redis.conf
save 900 1
save 300 10
save 60 10000
appendonly yes
```

### 3. PM2 Cluster Mode
The ecosystem config uses cluster mode to utilize all CPU cores.

### 4. Monitoring Setup

#### PM2 Monitoring
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress false
```

#### Application Metrics
Monitor the following endpoints:
- `/health` - Application health check
- `/api/v1/metrics` - Application metrics (if implemented)

## Post-deployment Tasks

### 1. Verify Deployment
```bash
# Check PM2 status
pm2 status

# Check application logs
pm2 logs daytradedak-api --lines 100

# Test API endpoint
curl -X GET https://api.daytradedak.com/health
```

### 2. Load Testing
Run load tests to verify performance:
```bash
npm run load-test:production
```

### 3. Setup Monitoring
Configure monitoring tools:
- CloudWatch (AWS)
- New Relic
- DataDog
- Custom monitoring dashboard

### 4. Backup Strategy
Implement automated backups:
```bash
# MongoDB backup script
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mongodump --uri="$MONGO_URI" --out="/backups/mongodb/$TIMESTAMP"
find /backups/mongodb -type d -mtime +7 -exec rm -rf {} \;
```

## Troubleshooting

### Common Issues

1. **Application won't start**
   - Check logs: `pm2 logs daytradedak-api`
   - Verify environment variables: `pm2 env 0`
   - Check MongoDB connection: `mongosh $MONGO_URI --eval "db.adminCommand('ping')"`

2. **High memory usage**
   - Check for memory leaks: `pm2 monit`
   - Adjust max_memory_restart in ecosystem.config.js
   - Review cache settings

3. **Slow response times**
   - Check database indexes: `npm run check-indexes`
   - Review Redis cache hit rate
   - Check PM2 cluster distribution

### Log Locations
- Application logs: `./logs/`
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`
- MongoDB logs: `/var/log/mongodb/`
- Redis logs: `/var/log/redis/`

## Security Checklist

- [ ] All environment variables are properly set
- [ ] SSL certificates are valid and auto-renewing
- [ ] Firewall rules are configured (only allow necessary ports)
- [ ] MongoDB has authentication enabled
- [ ] Redis has authentication enabled (if exposed)
- [ ] Rate limiting is properly configured
- [ ] CORS origins are restricted to allowed domains
- [ ] API keys and secrets are stored securely
- [ ] Regular security updates are scheduled

## Rollback Procedure

In case of deployment issues:

1. **Revert PM2 to previous version**
   ```bash
   pm2 stop daytradedak-api
   # Restore previous build
   pm2 start ecosystem.config.js
   ```

2. **Database rollback**
   ```bash
   # Restore from backup
   mongorestore --uri="$MONGO_URI" --drop /backups/mongodb/[TIMESTAMP]
   ```

3. **Clear Redis cache**
   ```bash
   redis-cli FLUSHALL
   ```

## Maintenance

### Regular Tasks
- Monitor disk space for logs
- Review and rotate logs weekly
- Update dependencies monthly
- Review performance metrics
- Test backup restoration quarterly

### Performance Tuning
- Adjust PM2 instances based on CPU cores
- Tune MongoDB connection pool size
- Optimize Redis memory usage
- Review and update database indexes

## Contact

For deployment issues or questions:
- Technical Lead: [email]
- DevOps Team: [email]
- Emergency: [phone]