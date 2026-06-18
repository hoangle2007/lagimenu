#!/usr/bin/env python3
import paramiko

HOST = "103.211.200.204"
USER = "root"
PASS = "5KE5Pg74XWCMT1hC"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=30)

cmds = [
    # Check what's inside nginx-proxy-manager
    "docker exec nginx-proxy-manager ls /data/nginx/ 2>&1 | head -20",
    # Check if there are proxy hosts configured
    "docker exec nginx-proxy-manager ls /data/nginx/proxy_host/ 2>&1 | head -10",
    # Check nginx config files for kivo-menu references
    "docker exec nginx-proxy-manager grep -r 'lagi\\|kivomenu\\|var/www' /data/nginx/ 2>&1 | head -20",
    # Reload nginx inside container
    "docker exec nginx-proxy-manager nginx -s reload 2>&1",
    # Check if backend is running somewhere
    "docker ps -a 2>&1",
]

import sys
sys.stdout.reconfigure(encoding='utf-8')

for cmd in cmds:
    print(f"\n$ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out:
        print(out)
    if err:
        print("ERR:", err[:200])

ssh.close()
