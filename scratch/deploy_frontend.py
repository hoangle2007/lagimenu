#!/usr/bin/env python3
"""Deploy frontend dist/ to VPS via SFTP"""
import os
import sys

try:
    import paramiko
except ImportError:
    print("Installing paramiko...")
    os.system("pip install paramiko")
    import paramiko

HOST = "103.211.200.204"
USER = "root"
PASS = "5KE5Pg74XWCMT1hC"
REMOTE_DIR = "/var/www/kivo-menu/frontend"
LOCAL_DIR = os.path.join(os.path.dirname(__file__), "..", "packages", "frontend", "dist")
LOCAL_DIR = os.path.abspath(LOCAL_DIR)

def upload_dir(sftp, local_path, remote_path):
    """Recursively upload a directory"""
    # Create remote dir if needed
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

# First, check/create remote dir
stdin, stdout, stderr = ssh.exec_command(f"mkdir -p {REMOTE_DIR}")
stdout.read()

sftp = ssh.open_sftp()
print(f"Uploading from {LOCAL_DIR} to {REMOTE_DIR}...")
upload_dir(sftp, LOCAL_DIR, REMOTE_DIR)
sftp.close()

print("\nDeploy complete! Reloading nginx...")
stdin, stdout, stderr = ssh.exec_command("nginx -s reload 2>&1 || systemctl reload nginx 2>&1 || echo 'nginx reload skipped'")
print(stdout.read().decode())
ssh.close()
print("Done!")
