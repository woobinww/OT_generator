module.exports = {
  apps: [{
    name: 'attendance-server',
    script: './server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    restart_delay: 3000,
    time: true,
    env: {
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: 3000
    }
  }]
};
