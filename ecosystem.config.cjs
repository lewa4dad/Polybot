// PM2 ecosystem config — run with: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "polybot",
      script: "src/index.js",
      interpreter: "node",
      interpreter_args: "--experimental-vm-modules",
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 5000,       // wait 5s before restart
      max_restarts: 20,          // max 20 restarts before giving up
      autorestart: true,
      exp_backoff_restart_delay: 100,
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      out_file: "logs/pm2-out.log",
      error_file: "logs/pm2-err.log",
      merge_logs: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
