#!/usr/bin/env python3
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

HOST = "103.211.200.204"
USER = "root"
PASS = "5KE5Pg74XWCMT1hC"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=30)

# Read all nginx proxy host configs
cmds = [
    "for f in /data/nginx/proxy_host/*.conf; do echo \"=== $f ===\"; cat $f; echo; done",
    # Check if there's a backend process running
    "ps aux | grep -E 'node|nest|pm2' | grep -v grep",
    # Check pm2 globally
    "which pm2 && pm2 list || echo 'pm2 not found on host'",
    # What's listening on ports?
    "ss -tlnp | grep -E '3000|3001|8080|4000'",
    # Any docker-compose files?
    "find / -name 'docker-compose*.yml' -not -path '*/proc/*' 2>/dev/null | head -10",
]

for cmd in cmds:
    print(f"\n$ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print(out or "(no output)")
    if err and 'not found' not in err and len(err) < 200:
        print("ERR:", err)

ssh.close()
