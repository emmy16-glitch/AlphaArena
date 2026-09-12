// PM2 process file for the Telegram → OpenCode bridge.
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup   # to resurrect on reboot
module.exports = {
  apps: [
    {
      name: "telegram-bridge",
      script: "bot.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
