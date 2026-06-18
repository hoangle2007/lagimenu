const { Client } = require('ssh2');

const conn = new Client();
const cmd = process.argv.slice(2).join(' ');

if (!cmd) {
  console.error('Please specify a command to execute.');
  process.exit(1);
}

conn.on('ready', () => {
  console.log(`SSH connection established. Executing:\n${cmd}\n`);
  
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
