// ─────────────────────────────────────────────────────────────
// PM2 Config — Droplet B (Background + Infrastructure Support)
// Place at /opt/tradereplay/ecosystem.config.cjs on Droplet B
// ─────────────────────────────────────────────────────────────
module.exports = {
  apps: [
    {
      name: "tradereplay-worker",
      script: "tsx",
      args: "src/worker.ts",
      cwd: "/opt/tradereplay/backend",
      instances: 1,
      exec_mode: "fork",
      env_file: "/opt/tradereplay/.env",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "200M",
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true,
      watch: false,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/tradereplay/worker-error.log",
      out_file: "/var/log/tradereplay/worker-out.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "tradereplay-kafka-service",
      script: "tsx",
      args: "src/kafkaService.ts",
      cwd: "/opt/tradereplay/backend",
      instances: 1,
      exec_mode: "fork",
      env_file: "/opt/tradereplay/.env",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "200M",
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true,
      watch: false,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/tradereplay/kafka-service-error.log",
      out_file: "/var/log/tradereplay/kafka-service-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
