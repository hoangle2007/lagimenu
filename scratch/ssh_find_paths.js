const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established.');
  
  const cmds = [
    'pm2 list',
    'pm2 show kivo-menu-frontend',
    'pm2 show kivo-menu-backend'
  ];
  
  runCommands(cmds);
}).connect({
  host: '103.211.200.204',
  port: 22,
  username: 'root',
  password: '5KE5Pg74XWCMT1hC'
});

function runCommands(cmds) {
  if (cmds.length === 0) {
    conn.end();
    return;
  }
  const cmd = cmds.shift();
  console.log(`\n=== Running: ${cmd} ===`);
  
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      runCommands(cmds);
      return;
    }
    stream.on('close', () => runCommands(cmds))
          .on('data', data => process.stdout.write(data.toString()))
          .stderr.on('data', data => process.stderr.write(data.toString()));
  });
}
