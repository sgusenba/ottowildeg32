#!/usr/bin/env python3
"""Statischer Dev-Server ohne Caching, damit Chrome nie veraltete JS-Module lädt.

Start:  python3 serve.py [port]      (Standard 8000)
Dann:   http://localhost:8000/index.html   bzw. /explorer.html
Lauscht nur auf localhost (Web Bluetooth braucht localhost oder https).
"""
import http.server
import os
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


class Server(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with Server(("127.0.0.1", port), NoCacheHandler) as httpd:
        print(f"G32 Dev-Server: http://localhost:{port}/index.html  (Strg+C beendet)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
