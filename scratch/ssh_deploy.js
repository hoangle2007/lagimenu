const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established. Starting deployment...');
  
  const cmds = [
    'export PATH=/www/server/nodejs/v20.20.2/bin:$PATH',
    'cd /root/kivomenu',
    'git reset --hard',
    'git pull origin main',
    'npm install',
    'npm run build -w packages/frontend',
    'pm2 restart kivo-menu-frontend',
    'pm2 list'
  ];
  
  const combinedCommand = cmds.join(' && ');
  
  console.log(`Executing combined command:\n${combinedCommand}\n`);
  
  conn.exec(combinedCommand, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log(`\nCommand finished with exit code: ${code}`);
      conn.end();
    })
    .on('data', data => process.stdout.write(data.toString()))
    .stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({
  host: '103.211.200.204',
  port: 22,
  username: 'root',
  password: '5KE5Pg74XWCMT1hC'
});
