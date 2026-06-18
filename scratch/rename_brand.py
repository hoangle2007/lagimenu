import os

replacements = [
    ("Lagi Menu", "Kivo Menu"),
    ("lagi menu", "kivo menu"),
    ("LagiMenu", "KivoMenu"),
    ("lagimenu", "kivomenu"),
    ("LAGIMENU", "KIVOMENU"),
    ("LagiMenuAdmin", "KivoMenuAdmin"),
    ("lagimenu_admin", "kivomenu_admin"),
    ("com.lagimenu", "com.kivomenu"),
    ("gulagi_secret", "gukivo_secret"),
    ("GULAGI", "GUKIVO"),
    ("gulagi", "gukivo"),
]

# We will exclude binary/compiled folders and package locks to prevent corruption
exclude_dirs = {
    ".git", ".github", "node_modules", "dist", "build", 
    ".gradle", ".idea", "build-in-windows", "build-in-linux",
    "android", "ios", "windows", "linux", "macos", "test-results"
}
exclude_files = {
    "package-lock.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", 
    "rename_brand.py", "deploy.zip", "ngrok.exe"
}

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        # Skip binary files
        return

    original_content = content
    for old, new in replacements:
        content = content.replace(old, new)
        
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {filepath}")

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print(f"Starting rename script in: {root_dir}")
    for root, dirs, files in os.walk(root_dir):
        # Modifying dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file in exclude_files:
                continue
            # Also ignore binary/object files based on extension
            if file.endswith(('.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.dll', '.exe', '.bin')):
                continue
            filepath = os.path.join(root, file)
            process_file(filepath)

if __name__ == "__main__":
    main()
