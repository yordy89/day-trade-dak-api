module.exports = {
  apps: [
    {
      name: 'daytradedak-api',
      script: 'dist/main.js',
      instances: 1, // IMPORTANT: Use 1 instance for cron jobs to avoid duplicates
      exec_mode: 'fork', // Use 'fork' mode instead of 'cluster' for cron jobs
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time: true,
      merge_logs: true,
      
      // Cron-specific settings
      cron_restart: '0 3 * * *', // Optional: Restart daily at 3 AM to clear memory
      
      // Ensure the process doesn't restart too quickly
      min_uptime: '10s',
      max_restarts: 10,
      
      // Environment variables for better cron handling
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        TZ: 'America/New_York', // Set your timezone
        FORCE_COLOR: '1', // Better logging colors
        NODE_OPTIONS: '--max-old-space-size=1024', // Memory management
      },
      
      // Auto-restart if memory usage is high
      max_memory_restart: '1G',
      
      // Kill timeout for graceful shutdown
      kill_timeout: 5000,
    },
  ],
};