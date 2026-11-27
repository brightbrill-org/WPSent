module.exports = {
  apps: [{
    name: 'wpsent-app',
    script: './server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    kill_timeout: 120000,
    restart_delay: 5000,
    watch: false
  }]
};
