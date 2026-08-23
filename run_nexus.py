#!/usr/bin/env python3
"""
VISXUU AI Launcher
Builds frontend, starts backend on all interfaces, creates public tunnel if possible,
and opens the app in browser.
"""

import subprocess
import sys
import os
import time
import webbrowser
import threading
import signal
import urllib.request
import json
import shutil
import socket

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.join(BASE_DIR, "server")
CLIENT_DIR = os.path.join(BASE_DIR, "client")

PORT = 3001
HEALTH_URL = f"http://localhost:{PORT}/api/health"
PUBLIC_URL = None
TUNNEL_PROCESS = None


def run_command(cmd, cwd=None, shell=True):
    return subprocess.Popen(
        cmd,
        cwd=cwd,
        shell=shell,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )


def stream_output(process, label):
    try:
        for line in process.stdout:
            line = line.rstrip()
            if line:
                print(f"[{label}] {line}")
    except Exception:
        pass


def wait_for_server(url, timeout=60):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(1)
    return False


def get_ngrok_url():
    try:
        with urllib.request.urlopen("http://localhost:4040/api/tunnels", timeout=2) as resp:
            data = json.loads(resp.read().decode())
            for tunnel in data.get("tunnels", []):
                if tunnel.get("proto") == "https":
                    return tunnel.get("public_url")
    except Exception:
        pass
    return None


def start_ngrok():
    ngrok = shutil.which("ngrok")
    if not ngrok:
        return None

    proc = run_command(f'"{ngrok}" http {PORT}', shell=True)
    time.sleep(3)

    url = get_ngrok_url()
    if url:
        print(f"[NGROK] Public URL: {url}")
        return proc
    try:
        proc.terminate()
    except Exception:
        pass
    return None


def start_localhost_run():
    ssh = shutil.which("ssh")
    if not ssh:
        return None, None

    proc = run_command(
        f'ssh -o StrictHostKeyChecking=no -R 80:localhost:{PORT} nokey@localhost.run',
        shell=True,
    )
    time.sleep(4)

    url = None
    try:
        for line in iter(proc.stdout.readline, ''):
            line = line.rstrip()
            if line:
                print(f"[TUNNEL] {line}")
                for part in line.split():
                    if part.startswith("http"):
                        url = part.strip()
                        break
            if url:
                break
    except Exception:
        pass

    if url:
        print(f"[TUNNEL] Public URL: {url}")
        return proc, url
    try:
        proc.terminate()
    except Exception:
        pass
    return None, None


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"


def main():
    global PUBLIC_URL, TUNNEL_PROCESS

    print("=" * 60)
    print("       VISXUU AI - Beyond Intelligence")
    print("=" * 60)

    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
        print("[OK] Node.js detected")
    except Exception:
        print("[ERROR] Node.js is not installed or not in PATH")
        sys.exit(1)

    missing = []
    for pkg in ["flask", "flask_cors"]:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"[INFO] Installing missing Python packages: {', '.join(missing)}")
        subprocess.run(
            [sys.executable, "-m", "pip", "install"] + missing,
            check=False,
        )

    print("[INFO] Starting VISXUU AI servers...\n")

    processes = []

    try:
        env = os.environ.copy()
        env["HOST"] = "0.0.0.0"
        env["PORT"] = str(PORT)

        print("[BACKEND] Starting server on all interfaces...")
        backend = subprocess.Popen(
            ["node", "server/index.js"],
            cwd=BASE_DIR,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        processes.append(backend)
        threading.Thread(
            target=stream_output, args=(backend, "BACKEND"), daemon=True
        ).start()

        if not wait_for_server(HEALTH_URL, timeout=60):
            print("[ERROR] Backend did not start in time")
            sys.exit(1)

        print(f"[BACKEND] Ready at {HEALTH_URL}\n")

        # Build frontend
        print("[BUILD] Building frontend...")
        build = run_command("npm run build", cwd=CLIENT_DIR, shell=True)
        build.wait()
        if build.returncode != 0:
            print("[WARN] Build failed, frontend may not load correctly")

        PUBLIC_URL = f"http://localhost:{PORT}"

        # Try public tunnels
        tunnel_result = start_ngrok()
        if tunnel_result:
            TUNNEL_PROCESS = tunnel_result
            time.sleep(2)
            PUBLIC_URL = get_ngrok_url() or PUBLIC_URL
        else:
            tunnel_result, url = start_localhost_run()
            if tunnel_result and url:
                TUNNEL_PROCESS = tunnel_result
                PUBLIC_URL = url

        local_ip = get_local_ip()
        if PUBLIC_URL == f"http://localhost:{PORT}":
            PUBLIC_URL = f"http://{local_ip}:{PORT}"

        print("\n" + "=" * 60)
        print("  VISXUU AI is running!")
        print(f"  Local : http://localhost:{PORT}")
        print(f"  Network: http://{local_ip}:{PORT}")
        if TUNNEL_PROCESS:
            print(f"  Public: {PUBLIC_URL}")
        print("  Press Ctrl+C to stop")
        print("=" * 60 + "\n")

        print("[BROWSER] Opening VISXUU AI...")
        webbrowser.open(PUBLIC_URL)
        time.sleep(1)

        while True:
            time.sleep(1)
            for p in processes:
                if p.poll() is not None:
                    print(f"[WARN] Process exited with code {p.returncode}")

    except KeyboardInterrupt:
        print("\n[INFO] Shutting down VISXUU AI...")
    finally:
        for p in processes:
            try:
                p.terminate()
            except Exception:
                pass
        if TUNNEL_PROCESS:
            try:
                TUNNEL_PROCESS.terminate()
            except Exception:
                pass
        print("[INFO] All servers stopped.")


if __name__ == "__main__":
    main()
