module.exports = {
  apps: [
    {
      name: 'mcl-ct-backend',
      cwd: './backend',
      script: 'src/api-server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
