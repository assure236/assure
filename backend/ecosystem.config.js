module.exports = {
  apps: [{
    name: 'assure-backend',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512',
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
    },
    // Graceful restart
    kill_timeout: 5000,
    listen_timeout: 10000,
    // Auto-restart on crash
    autorestart: true,
    max_restarts: 10,
    restart_delay: 1000,
    // Logs
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
