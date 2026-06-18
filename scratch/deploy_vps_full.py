#!/usr/bin/env python3
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8')

HOST = "103.211.200.204"
USER = "root"
PASS = "5KE5Pg74XWCMT1hC"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f"Connecting to {HOST}...")
ssh.connect(HOST, username=USER, password=PASS, timeout=60)
print("Connected!")

cmds = [
    # 1. Update PATH to ensure node/npm/pm2 are in scope
    "export PATH=/www/server/nodejs/v20.20.2/bin:$PATH",
    # 2. Pull latest code
    "cd /root/lagimenu",
    "git reset --hard",
    "git pull origin main",
    # 3. Clean install and build
    "npm install",
    "npm run build",
    # 4. Remove old PM2 services
    "pm2 delete kivo-menu-backend || true",
    "pm2 delete kivo-menu-frontend || true",
    # 5. Start new PM2 services via ecosystem config
    "pm2 start ecosystem.config.js",
    # 6. Persist PM2 list
    "pm2 save",
    # 7. Check final status
    "pm2 list"
]

combined_cmd = " && ".join(cmds)
print(f"\nExecuting commands on VPS:\n{combined_cmd}\n")

stdin, stdout, stderr = ssh.exec_command(combined_cmd)

# Print standard output in real-time or wait for completion
print("--- stdout ---")
for line in stdout:
    print(line, end="")

print("\n--- stderr ---")
for line in stderr:
    print(line, end="")

ssh.close()
print("\nDeployment execution finished!")
