import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8778


class H(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'   # keep-alive so Edge/Chrome don't stall on reconnects

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *args):
        pass   # quiet


# ThreadingHTTPServer handles each connection on its own thread, so speculative
# preconnect sockets from the browser can't block the actual page request.
httpd = ThreadingHTTPServer(('', PORT), H)
httpd.daemon_threads = True
print('no-cache server on http://localhost:%d/' % PORT, flush=True)
httpd.serve_forever()
