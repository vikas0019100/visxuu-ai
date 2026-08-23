#!/usr/bin/env python3
"""
VISXUU AI Deployment Helper
Guides you through GitHub and Render deployment.
"""

import os
import sys
import subprocess

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def run(cmd, cwd=None):
    print(f"\n$ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd or BASE_DIR)
    if result.returncode != 0:
        print(f"[ERROR] Command failed: {cmd}")
        sys.exit(result.returncode)


def main():
    print("=" * 60)
    print("       VISXUU AI - Deployment Helper")
    print("=" * 60)

    # Check git
    try:
        subprocess.run(["git", "--version"], capture_output=True, check=True)
    except Exception:
        print("[ERROR] Git is not installed")
        sys.exit(1)

    # Get GitHub username
    print("\n[STEP 1] GitHub Setup")
    print("Please create a new repository on GitHub:")
    print("1. Go to https://github.com/new")
    print("2. Repository name: visxuu-ai")
    print("3. Set as Public")
    print("4. Do NOT initialize with README")
    print("5. Click 'Create repository'\n")

    username = input("Enter your GitHub username: ").strip()
    repo_url = f"https://github.com/{username}/visxuu-ai.git"

    print(f"\n[STEP 2] Pushing to GitHub...")
    run("git branch -M main")
    run(f"git remote add origin {repo_url}")
    run("git push -u origin main")

    print("\n[STEP 3] Deploy to Render.com")
    print("1. Go to https://render.com")
    print("2. Sign up / Login with GitHub")
    print("3. Click 'New +' → 'Web Service'")
    print("4. Select your 'visxuu-ai' repository")
    print("5. Render will auto-detect render.yaml")
    print("6. Click 'Create Web Service'")
    print("\n[STEP 4] Add Environment Variables")
    print("In Render dashboard → Environment tab, add:")
    print("  NODE_ENV=production")
    print("  HOST=0.0.0.0")
    print("  PORT=3001")
    print("  OPENAI_API_KEY=your_key (optional)")
    print("\n[STEP 5] Wait 5-10 minutes for deployment")
    print(f"Your app will be live at: https://visxuu-ai.onrender.com")
    print("\n[DONE] Deployment guide complete!")


if __name__ == "__main__":
    main()
