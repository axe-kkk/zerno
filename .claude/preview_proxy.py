"""Small dev proxy for previewing the zerno frontend with real backend.
Serves frontend/ at /, proxies /api/* to http://localhost:8000/api/*."""
import http.server, http.client, os, socketserver, sys, urllib.request, urllib.error

PORT = int(os.environ.get('PORT', '8765'))
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
BACKEND = 'localhost:8000'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def _proxy(self):
        conn = http.client.HTTPConnection(BACKEND, timeout=15)
        body = None
        if 'Content-Length' in self.headers:
            body = self.rfile.read(int(self.headers['Content-Length']))
        headers = {k: v for k, v in self.headers.items() if k.lower() not in ('host', 'connection')}
        try:
            conn.request(self.command, self.path, body=body, headers=headers)
            res = conn.getresponse()
            self.send_response(res.status)
            for k, v in res.getheaders():
                if k.lower() in ('transfer-encoding', 'connection'):
                    continue
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(res.read())
        except Exception as e:
            self.send_error(502, f'Proxy error: {e}')
        finally:
            conn.close()

    def do_GET(self):
        if self.path.startswith('/api/'):
            return self._proxy()
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/'):
            return self._proxy()
        self.send_error(405)

    def do_PUT(self):
        if self.path.startswith('/api/'):
            return self._proxy()
        self.send_error(405)

    def do_DELETE(self):
        if self.path.startswith('/api/'):
            return self._proxy()
        self.send_error(405)

    def do_PATCH(self):
        if self.path.startswith('/api/'):
            return self._proxy()
        self.send_error(405)


class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

with ThreadedHTTPServer(('127.0.0.1', PORT), Handler) as httpd:
    print(f'Preview proxy on http://127.0.0.1:{PORT}/  (api -> {BACKEND})', flush=True)
    httpd.serve_forever()
