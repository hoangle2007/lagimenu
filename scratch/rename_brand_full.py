import os
import shutil

replacements = [
    ("Lagi Menu", "Kivo Menu"),
    ("lagi menu", "kivo menu"),
    ("LagiMenu", "KivoMenu"),
    ("lagimenu", "kivomenu"),
    ("LAGIMENU", "KIVOMENU"),
    ("Lagimenu", "Kivomenu"),
    ("LagiMenuAdmin", "KivoMenuAdmin"),
    ("lagimenu_admin", "kivomenu_admin"),
    ("com.lagimenu", "com.kivomenu"),
    ("lagi_menu", "kivo_menu"),
    ("lagi-menu", "kivo-menu"),
    ("lagi.test", "kivo.test"),
    ("lagi_token", "kivo_token"),
    ("lagi_merchant", "kivo_merchant"),
    ("@lagimenu/", "@kivomenu/"),
    ("gulagi_secret", "gukivo_secret"),
    ("GULAGI", "GUKIVO"),
    ("gulagi", "gukivo"),
]

exclude_dirs = {
    ".git", ".github", "node_modules", "dist", "build", 
    ".gradle", ".idea", "build-in-windows", "build-in-linux",
    "test-results"
}
exclude_files = {
    "package-lock.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", 
    "rename_brand.py", "rename_brand_full.py", "deploy.zip", "ngrok.exe"
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
        print(f"Updated content in: {filepath}")

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print(f"Starting rename script in: {root_dir}")
    
    # 1. Update file contents
    for root, dirs, files in os.walk(root_dir):
        # Modifying dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file in exclude_files:
                continue
            # Ignore binary files by extension
            if file.endswith(('.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.dll', '.exe', '.bin')):
                continue
            filepath = os.path.join(root, file)
            process_file(filepath)
            
    # 2. Relocate Android MainActivity if it exists in the old package directory
    old_kotlin_dir = os.path.join(root_dir, "packages", "mobile", "android", "app", "src", "main", "kotlin", "com", "lagimenu", "lagimenu_admin")
    new_kotlin_dir = os.path.join(root_dir, "packages", "mobile", "android", "app", "src", "main", "kotlin", "com", "kivomenu", "kivomenu_admin")
    
    old_main_activity = os.path.join(old_kotlin_dir, "MainActivity.kt")
    new_main_activity = os.path.join(new_kotlin_dir, "MainActivity.kt")
    
    if os.path.exists(old_main_activity):
        os.makedirs(new_kotlin_dir, exist_ok=True)
        shutil.move(old_main_activity, new_main_activity)
        print(f"Moved MainActivity.kt to: {new_main_activity}")
        # Clean up empty parent directories
        try:
            os.rmdir(old_kotlin_dir)
            os.rmdir(os.path.dirname(old_kotlin_dir))
            print("Cleaned up old package directory structures.")
        except Exception as e:
            print(f"Directory cleanup note: {e}")

if __name__ == "__main__":
    main()
