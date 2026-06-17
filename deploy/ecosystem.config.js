module.exports = {
  apps: [
    {
      name: 'lagi-menu-backend',
      cwd: './packages/backend',
      script: 'dist/src/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'lagi-menu-frontend',
      script: 'npx',
      args: 'serve -s dist -l 4100',
      cwd: './packages/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      }
    }
  ]
};
