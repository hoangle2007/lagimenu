#!/usr/bin/env python3
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

HOST = "103.211.200.204"
USER = "root"
PASS = "5KE5Pg74XWCMT1hC"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=30)

cmds = [
    'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
    'ls /var/www/kivo-menu/ 2>/dev/null || echo "no_www_dir"',
    'which nginx apache2 caddy 2>/dev/null || echo "no_webserver"',
    'pm2 list 2>/dev/null || echo "no_pm2"',
]

for cmd in cmds:
    print(f"\n$ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print(out)
    if err:
        print("ERR:", err)

ssh.close()
