#!/usr/bin/env python3
"""Serve this folder over HTTPS so a phone on the same Wi-Fi can open it."""

import http.server
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CERT_DIR = ROOT / ".certs"
PORT = 8443


def lan_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("192.168.1.1", 80))
        return sock.getsockname()[0]
    finally:
        sock.close()


def ensure_cert(ip: str) -> tuple[Path, Path]:
    CERT_DIR.mkdir(exist_ok=True)
    key = CERT_DIR / "key.pem"
    cert = CERT_DIR / "cert.pem"
    stamp = CERT_DIR / "ip.txt"
    if cert.exists() and key.exists() and stamp.exists() and stamp.read_text().strip() == ip:
        return cert, key
    san = f"subjectAltName=IP:{ip},IP:127.0.0.1,DNS:localhost"
    subprocess.check_call(
        [
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", str(key), "-out", str(cert),
            "-days", "30", "-nodes",
            "-subj", "/CN=exposure",
            "-addext", san,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    stamp.write_text(ip + "\n")
    return cert, key


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/.certs"):
            self.send_error(404)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    ip = lan_ip()
    cert, key = ensure_cert(ip)
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    ctx = __import__("ssl").SSLContext(__import__("ssl").PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert, key)
    server.socket = ctx.wrap_socket(server.socket, server_side=True)
    print(f"https://{ip}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
