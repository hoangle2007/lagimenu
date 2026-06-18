module.exports = {
  apps: [
    {
      name: 'kivo-menu-backend',
      cwd: './packages/backend',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'kivo-menu-frontend',
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
