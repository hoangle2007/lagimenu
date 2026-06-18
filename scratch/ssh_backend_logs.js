const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established. Fetching PM2 logs...');
  
  const cmd = 'export PATH=/www/server/nodejs/v20.20.2/bin:$PATH; pm2 logs kivo-menu-backend --lines 150 --raw --nostream';
  
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log(`\nLogs fetch finished with exit code: ${code}`);
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
