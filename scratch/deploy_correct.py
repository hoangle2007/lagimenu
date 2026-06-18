#!/usr/bin/env python3
"""Deploy frontend dist/ to correct path on VPS: /root/kivomenu/packages/frontend/dist/"""
import paramiko, os, sys
sys.stdout.reconfigure(encoding='utf-8')

HOST = "103.211.200.204"
USER = "root"
PASS = "5KE5Pg74XWCMT1hC"
REMOTE_DIR = "/root/kivomenu/packages/frontend/dist"
LOCAL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "packages", "frontend", "dist"))

def upload_dir(sftp, local_path, remote_path):
    try:
        sftp.stat(remote_path)
    except FileNotFoundError:
        sftp.mkdir(remote_path)

    for item in os.listdir(local_path):
        local_item = os.path.join(local_path, item)
        remote_item = remote_path + "/" + item
        if os.path.isdir(local_item):
            upload_dir(sftp, local_item, remote_item)
        else:
            print(f"  Uploading: {remote_item}")
            sftp.put(local_item, remote_item)

print(f"Connecting to {HOST}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=30)
print("Connected!")

# Check current frontend pm2 process info
print("\n--- PM2 kivo-menu-frontend info ---")
stdin, stdout, stderr = ssh.exec_command("pm2 show kivo-menu-frontend 2>&1 | grep -E 'script|cwd|status|port|interpreter'")
print(stdout.read().decode('utf-8', errors='replace'))

# Upload files
sftp = ssh.open_sftp()
print(f"\nUploading from:\n  {LOCAL_DIR}\nTo:\n  {REMOTE_DIR}\n")
upload_dir(sftp, LOCAL_DIR, REMOTE_DIR)
sftp.close()

# Restart frontend pm2
print("\n--- Restarting kivo-menu-frontend ---")
stdin, stdout, stderr = ssh.exec_command("pm2 restart kivo-menu-frontend 2>&1")
print(stdout.read().decode('utf-8', errors='replace'))

# Confirm status
print("\n--- PM2 status after restart ---")
stdin, stdout, stderr = ssh.exec_command("pm2 list 2>&1 | grep lagi")
print(stdout.read().decode('utf-8', errors='replace'))

ssh.close()
print("\nDone!")
