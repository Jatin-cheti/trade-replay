module.exports = {
  apps: [
    {
      name: "tradereplay-backend",
      script: "tsx",
      args: "src/server.ts",
      cwd: "/opt/tradereplay/backend",
      instances: 1,
      exec_mode: "fork",
      env_file: "/opt/tradereplay/.env",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "300M",
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true,
      watch: false,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/tradereplay/error.log",
      out_file: "/var/log/tradereplay/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
