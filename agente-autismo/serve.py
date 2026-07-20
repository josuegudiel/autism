#!/usr/bin/env python3
"""Servidor estático mínimo para previsualizar la PWA en local.
Uso:  python3 serve.py   →   abre http://127.0.0.1:8099
Sirve la carpeta web/ (junto a este archivo)."""
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

WEBDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
PORT = 8099

Handler = partial(SimpleHTTPRequestHandler, directory=WEBDIR)
httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
print(f"Brújula TEA en http://127.0.0.1:{PORT}  (Ctrl+C para detener)")
httpd.serve_forever()
