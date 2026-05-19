#!/usr/bin/env python3
"""
serve.py — Simple local dev server for Cosmic Chord Circle.
No dependencies beyond Python 3 stdlib.

Usage:
    python3 serve.py
    # then open http://localhost:8080
"""

import http.server
import socketserver
import os
import socket

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, fmt, *args):
        print(f"  {self.address_string()}  {fmt % args}")


class ReuseServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ReuseServer(("", PORT), Handler) as httpd:
        print(f"\n  Cosmic Chord Circle")
        print(f"  -------------------")
        print(f"  Running at  http://localhost:{PORT}")
        print(f"  Press Ctrl+C to stop.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Server stopped.")
