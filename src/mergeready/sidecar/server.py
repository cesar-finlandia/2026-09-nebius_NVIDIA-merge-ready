import http.server
import json
import traceback

_ROUTERS = {}


def register_router(prefix, handler):
    _ROUTERS[prefix] = handler


def _send_json(self, obj):
    body = json.dumps(obj).encode("utf-8")
    self.send_response(200)
    self.send_header("Content-Type", "application/json")
    self.send_header("Content-Length", str(len(body)))
    self.end_headers()
    self.wfile.write(body)


class _Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        return None

    def do_GET(self):
        if self.path == "/healthz" or self.path.split("?")[0] == "/healthz":
            _send_json(self, {"ok": True})
            return
        # Read-only cost routes (DP-LEDGER: GET /cost/policy, GET /cost/summary)
        # are safe to serve on GET. Mutating routers (/sandbox, /jobs) stay
        # POST-only and keep returning NotFound here.
        for cand in sorted(_ROUTERS.keys(), key=len, reverse=True):
            if cand != "/cost":
                continue
            if self.path == cand or self.path.startswith(cand + "/") or self.path.startswith(cand + "?"):
                handler = _ROUTERS[cand]
                subpath = self.path[len(cand):] or "/"
                try:
                    result = handler(subpath, {})
                except Exception as e:
                    _send_json(self, {"error": {"kind": type(e).__name__, "message": str(e)[:500]}})
                    return
                if isinstance(result, dict) and "_status" in result:
                    result = {k: v for k, v in result.items() if not k.startswith("_")}
                _send_json(self, result)
                return
        _send_json(self, {"error": {"kind": "NotFound"}})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length > 0 else b""
        try:
            body_dict = json.loads(raw.decode("utf-8") if raw else "{}")
        except Exception:
            _send_json(self, {"error": {"kind": "BadRequest", "message": "invalid JSON"}})
            return
        if not isinstance(body_dict, dict):
            _send_json(self, {"error": {"kind": "BadRequest", "message": "invalid JSON"}})
            return
        prefix = None
        for cand in sorted(_ROUTERS.keys(), key=len, reverse=True):
            if self.path == cand or self.path.startswith(cand):
                prefix = cand
                break
        if prefix is None:
            _send_json(self, {"error": {"kind": "NotFound"}})
            return
        handler = _ROUTERS[prefix]
        subpath = self.path[len(prefix):] or "/"
        try:
            result = handler(subpath, body_dict)
        except Exception as e:
            _send_json(self, {"error": {"kind": type(e).__name__, "message": str(e)[:500]}})
            return
        if isinstance(result, dict):
            result = {k: v for k, v in result.items() if not k.startswith("_")}
        _send_json(self, result)


def serve(port):
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), _Handler)
    httpd.serve_forever()
