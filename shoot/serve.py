#!/usr/bin/env python3
"""
serve.py — a static server that honours HTTP Range.

  python3 serve.py [port]        # 0 (the default) picks a free port and prints it

python3 -m http.server does NOT serve byte ranges. A scrub film served without ranges cannot seek, so the
page sits on frame zero and the scroll looks broken while the film is perfectly fine. Always use this.
Serves the directory it is RUN FROM, not the one it lives in.
"""
import http.server, json, os, re, socketserver, sys, tempfile
from urllib.parse import urlparse, parse_qs

class Range(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        rng = self.headers.get("Range")
        if not rng:
            return super().send_head()
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404); return None
        size = os.fstat(f.fileno()).st_size
        m = re.match(r"bytes=(\d*)-(\d*)", rng.strip())
        if not m:
            f.close(); self.send_error(400); return None
        a, b = m.group(1), m.group(2)
        if a == "":                                    # suffix range: last N bytes
            start, end = max(0, size - int(b or 0)), size - 1
        else:
            start = int(a); end = int(b) if b else size - 1
        if start >= size or end < start:
            f.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers(); return None
        end = min(end, size - 1)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        f.seek(start)
        self.wrote = end - start + 1
        return _Slice(f, end - start + 1)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        # no-cache, NOT no-store. no-store makes the browser re-download the whole film on every
        # single reload (26 MB each time), which looks like the page getting slower and rougher the
        # more you load it. no-cache still revalidates every time, but a 304 costs nothing.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # ---- admin API (local only): the product list and product photos --------------------------
    # The public pages only ever READ data/products.json as a static file, so they work on any
    # static host. Writing goes through these two routes, which answer only to this machine.
    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def _local(self):
        return self.client_address[0] in ("127.0.0.1", "::1")

    def do_PUT(self):
        if urlparse(self.path).path != "/api/products": return self._json(404, {"error": "not found"})
        if not self._local(): return self._json(403, {"error": "admin is local only"})
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > 2_000_000: return self._json(413, {"error": "body missing or too large"})
        try: data = json.loads(self.rfile.read(n))
        except ValueError: return self._json(400, {"error": "not JSON"})
        err = validate_products(data)
        if err: return self._json(422, {"error": err})
        path = os.path.join(os.getcwd(), "data", "products.json")
        if os.path.exists(path):
            with open(path, "rb") as a, open(path.replace(".json", ".backup.json"), "wb") as b: b.write(a.read())
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f: json.dump(data, f, indent=1, ensure_ascii=False)
        os.replace(tmp, path)   # atomic: a crash mid-write can never leave a half-written list
        return self._json(200, {"ok": True, "count": len(data["products"])})

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != "/api/upload": return self._json(404, {"error": "not found"})
        if not self._local(): return self._json(403, {"error": "admin is local only"})
        name = (parse_qs(u.query).get("name") or [""])[0].lower()
        base, ext = os.path.splitext(re.sub(r"[^a-z0-9._-]+", "-", name).strip("-.")) if name else ("", "")
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".avif") or not base:
            return self._json(400, {"error": "need ?name=<file>.jpg|png|webp|avif"})
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > 12_000_000: return self._json(413, {"error": "image missing or over 12 MB"})
        folder = os.path.join(os.getcwd(), "assets", "products", "img"); os.makedirs(folder, exist_ok=True)
        out, k = os.path.join(folder, base + ext), 2
        while os.path.exists(out): out = os.path.join(folder, f"{base}-{k}{ext}"); k += 1
        with open(out, "wb") as f: f.write(self.rfile.read(n))
        return self._json(200, {"path": os.path.relpath(out, os.getcwd()).replace(os.sep, "/")})

def validate_products(d):
    if not isinstance(d, dict) or not isinstance(d.get("products"), list): return "expected {\"products\": [...]}"
    ids, slots = set(), set()
    for i, p in enumerate(d["products"], 1):
        where = f"product {i} ({p.get('name') or p.get('id') or '?'})"
        if not isinstance(p, dict): return f"{where}: not an object"
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", str(p.get("id", ""))): return f"{where}: id must be lower-case words joined by hyphens"
        if p["id"] in ids: return f"{where}: duplicate id"
        ids.add(p["id"])
        if not str(p.get("name", "")).strip(): return f"{where}: name is empty"
        if p.get("type") not in ("Indica", "Hybrid", "Sativa"): return f"{where}: type must be Indica, Hybrid or Sativa"
        for k in ("indica", "thc", "cbd"):
            v = p.get(k)
            if not isinstance(v, (int, float)) or not 0 <= v <= 100: return f"{where}: {k} must be a number from 0 to 100"
        s = p.get("slot")
        if not isinstance(s, int) or s < 1: return f"{where}: slot must be a whole number from 1"
        if s in slots: return f"{where}: slot {s} is already taken"
        slots.add(s)
        if p.get("stock") not in ("in", "low", "out"): return f"{where}: stock must be in, low or out"
        if not isinstance(p.get("terpenes", []), list): return f"{where}: terpenes must be a list"
        img = str(p.get("image", ""))
        if img and not img.startswith("assets/products/img/"): return f"{where}: image must live in assets/products/img/"
    return None

class _Slice:
    """file-like wrapper that yields exactly n bytes, so copyfile() stops at the range end"""
    def __init__(self, f, n): self.f, self.n = f, n
    def read(self, k=-1):
        if self.n <= 0: return b""
        k = self.n if k < 0 else min(k, self.n)
        d = self.f.read(k); self.n -= len(d); return d
    def close(self): self.f.close()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 0

class Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    """THREADED, and it matters. A scrub film is one long-lived range request that the browser holds
    open while it seeks. On a single-threaded TCPServer every other request — the CSS, the JS, every
    thumbnail, and each subsequent seek — queues behind it, so the page loads in pieces, seeks stall,
    and fresh connections are refused outright. That reads exactly like 'the site is laggy'."""
    daemon_threads = True
    allow_reuse_address = True

with Server(("127.0.0.1", port), Range) as httpd:
    actual = httpd.server_address[1]
    print(f"serving {os.getcwd()} on http://localhost:{actual}", flush=True)
    httpd.serve_forever()
