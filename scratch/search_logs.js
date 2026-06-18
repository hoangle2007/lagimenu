const { Client } = require('ssh2');

const conn = new Client();
const cmd = "grep -i -C 5 -E \"error|exception|fail\" ~/.pm2/logs/kivo-menu-backend-out-28.log | tail -n 150";

conn.on('ready', () => {
  console.log('SSH connection established. Searching logs for errors/exceptions...');
  
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log(`\nExit code: ${code}`);
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
