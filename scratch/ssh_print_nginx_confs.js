const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established.');
  
  const cmd = 'tail -n 100 /opt/nginx-proxy-manager/data/nginx/proxy_host/*.conf';
  console.log(`>>> Running: ${cmd}`);
  
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', () => conn.end())
          .on('data', data => process.stdout.write(data.toString()))
          .stderr.on('data', data => process.stderr.write(data.toString()));
  });
}).connect({
  host: '103.211.200.204',
  port: 22,
  username: 'root',
  password: '5KE5Pg74XWCMT1hC'
});
