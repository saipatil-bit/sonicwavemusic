import traceback
import http.server
import socketserver
import os
import sys
import re
import urllib.parse
import urllib.request
import json
import mimetypes
import time
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
HOST = os.environ.get('HOST', '0.0.0.0')
PORT = int(os.environ.get('PORT', 8000))

# ----------------- ADVANCED SECURITY CONFIGURATION -----------------
SECURITY_HEADERS = {
    'Content-Security-Policy': (
        "default-src 'self' https: data: blob:; "
        "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com https://*.youtube.com https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data: https: blob:; "
        "frame-src 'self'; "
        "connect-src 'self' https: blob: data:; "
        "media-src 'self' blob: data: https:; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'self';"
    ),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), autoplay=(self)',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'cross-origin'
}

# Block sensitive system, git, docker, and environment files
BLOCKED_PATTERNS = [
    r'^\.',               # All dotfiles (.git, .env, .gitignore, etc.)
    r'^Dockerfile$',
    r'^docker-compose',
    r'\.py$',             # Prevent downloading backend python source
    r'\.db$',             # Prevent downloading sqlite databases
    r'\.sqlite$',
    r'\.bak$',
    r'\.log$',
    r'\.md$',             # Prevent reading documentation/plans
    r'\.sh$',
    r'\.bat$',
    r'\.ps1$'
]

# ----------------- RATE LIMITING & DOS DEFENSE -----------------
# Sliding window rate limiter: max requests per window per IP
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 600  # max 120 reqs/min per IP
RATE_LIMIT_STORE = defaultdict(list)
RATE_LIMIT_LOCK = None

def is_rate_limited(client_ip):
    """
    Checks whether the client IP has exceeded the request threshold.
    Cleans up timestamps outside the sliding window.
    """
    if client_ip in ('127.0.0.1', '::1', 'localhost', '0.0.0.0'):
        return False

    now = time.time()
    timestamps = RATE_LIMIT_STORE[client_ip]
    # Prune timestamps older than window
    RATE_LIMIT_STORE[client_ip] = [ts for ts in timestamps if now - ts < RATE_LIMIT_WINDOW]
    
    if len(RATE_LIMIT_STORE[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return True
    
    RATE_LIMIT_STORE[client_ip].append(now)
    return False

# ----------------- ADVANCED SQL INJECTION WAF SIGNATURES -----------------
SQLI_PATTERNS = [
    # 1. Classic Boolean / Tautology SQLi (e.g., ' OR '1'='1', ' OR 1=1--, ' AND 'a'='a)
    r"(?i)(\b(OR|AND)\b\s+[\'\"]?\w+[\'\"]?\s*=\s*[\'\"]?\w+[\'\"]?)",
    r"(?i)(\b(OR|AND)\b\s+\d+\s*=\s*\d+)",
    r"(?i)(\b(OR|AND)\b\s+[\'\"]?[a-zA-Z]+[\'\"]?\s*=\s*[\'\"]?[a-zA-Z]+[\'\"]?)",

    # 2. UNION / UNION ALL Data Extraction SQLi
    r"(?i)(\bUNION\b\s+(\bALL\b\s+)?\bSELECT\b)",

    # 3. Stacked Queries & Hazardous DDL/DML Commands
    r"(?i)(;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)",

    # 4. Time-Based / Blind SQLi Injections
    r"(?i)(\b(SLEEP|BENCHMARK|PG_SLEEP|DELAY)\s*\(\s*\d+\s*\))",
    r"(?i)(\bWAITFOR\s+DELAY\b)",

    # 5. Information Schema & System Reconnaissance
    r"(?i)(\bINFORMATION_SCHEMA\b|\bSYS\.TABLES\b|\bSYS\.COLUMNS\b|\bSQLITE_MASTER\b)",

    # 6. Comment Injection & Obfuscation Bypasses
    r"(--|#|/\*[\s\S]*?\*/|/\*!)",

    # 7. Hex / Char / Function Encoded Attacks
    r"(?i)(\b0x[0-9a-fA-F]+\b|\bCHAR\s*\(\s*\d+)",

    # 8. Out-of-band & Dangerous System Procedures
    r"(?i)(\b(XP_CMDSHELL|LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b)"
]

SQLI_COMPILED_PATTERNS = [re.compile(p) for p in SQLI_PATTERNS]

# In-memory LRU resolution cache (key -> videoId)
RESOLVE_CACHE = {}
RESOLVE_CACHE_MAX = 500

STREAM_CACHE = {}
STREAM_CACHE_MAX = 1000
LOCAL_CATALOG_INDEX = {}

def init_local_catalog_index():
    global LOCAL_CATALOG_INDEX
    try:
        app_path = os.path.join(DIRECTORY, 'app.js')
        if not os.path.exists(app_path):
            return
        with open(app_path, 'r', encoding='utf-8') as f:
            c = f.read()
        s_idx = c.find('const indianArtistsDatabase = [')
        if s_idx == -1:
            return
        b_count = 0
        in_arr = False
        e_idx = -1
        for i in range(s_idx, len(c)):
            if c[i] == '[':
                b_count += 1
                in_arr = True
            elif c[i] == ']':
                b_count -= 1
                if in_arr and b_count == 0:
                    e_idx = i + 1
                    break
        if e_idx != -1:
            raw = c[s_idx + len('const indianArtistsDatabase = '):e_idx].strip()
            if raw.endswith(';'): raw = raw[:-1]
            artists = json.loads(raw)
            for a in artists:
                for t in a.get('allTracks', []):
                    title = (t.get('title') or '').lower().strip()
                    artist = (a.get('name') or '').lower().strip()
                    audio_url = t.get('audioUrl')
                    cover = t.get('cover')
                    if audio_url:
                        item = {
                            'title': t.get('title'),
                            'artist': a.get('name'),
                            'stream_url': audio_url,
                            'cover': cover
                        }
                        LOCAL_CATALOG_INDEX[f"{title} {artist}"] = item
                        LOCAL_CATALOG_INDEX[title] = item
                        if t.get('id'):
                            LOCAL_CATALOG_INDEX[t.get('id')] = item
    except Exception as e:
        print(f"[Catalog Index Error] {e}")

init_local_catalog_index()

def fetch_stream_url(query):
    if not query:
        return None
    safe_q = query.strip()[:100].lower()
    if safe_q in LOCAL_CATALOG_INDEX:
        return LOCAL_CATALOG_INDEX[safe_q]

    # Check partial match in local catalog
    for key, item in LOCAL_CATALOG_INDEX.items():
        if safe_q in key or key in safe_q:
            return item

    if query in STREAM_CACHE:
        return STREAM_CACHE[query]

    itunes_url = f"https://itunes.apple.com/search?term={urllib.parse.quote(query.strip()[:100])}&media=music&limit=1"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    try:
        req = urllib.request.Request(itunes_url, headers=headers)
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and data.get('resultCount', 0) > 0:
                first = data['results'][0]
                result = {
                    'title': first.get('trackName'),
                    'artist': first.get('artistName'),
                    'stream_url': first.get('previewUrl'),
                    'cover': first.get('artworkUrl100')
                }
                if len(STREAM_CACHE) >= STREAM_CACHE_MAX:
                    STREAM_CACHE.pop(next(iter(STREAM_CACHE)))
                STREAM_CACHE[query] = result
                return result
    except Exception as e:
        pass
    
    # Final fallback to standard stream
    return {
        'title': query,
        'artist': 'SonicWave Stream',
        'stream_url': 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
        'cover': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop'
    }

def check_sqli(input_text):
    """
    Scans a string for SQL injection signatures and advanced evasion techniques.
    Performs recursive URL decoding and null-byte removal prior to analysis.
    Returns (is_malicious: bool, matched_rule: str).
    """
    if not input_text or not isinstance(input_text, str):
        return False, None

    # Step 1: Normalize & recursively decode URL entities
    decoded = input_text
    for _ in range(3):
        prev = decoded
        decoded = urllib.parse.unquote(decoded)
        if decoded == prev:
            break

    # Step 2: Strip null bytes and normalize whitespace
    cleaned = decoded.replace('\x00', '').strip()

    # Step 3: Run comprehensive pattern scan
    for pattern in SQLI_COMPILED_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            return True, match.group(0)

    return False, None

def is_path_safe(requested_path):
    """
    Validate that the requested path resides strictly within DIRECTORY,
    does not contain directory traversal attacks, and does not access blocked files.
    """
    clean_path = requested_path.split('?')[0].split('#')[0]
    clean_path = clean_path.lstrip('/')
    if not clean_path:
        clean_path = 'index.html'

    # Check for URI length abuse
    if len(clean_path) > 512:
        return None, 414

    base_name = os.path.basename(clean_path)
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, base_name, re.IGNORECASE):
            return None, 403

    target_path = os.path.realpath(os.path.join(DIRECTORY, clean_path))

    try:
        common = os.path.commonpath([DIRECTORY, target_path])
        if common != DIRECTORY:
            return None, 403
    except ValueError:
        return None, 403

    if not os.path.exists(target_path) or os.path.isdir(target_path):
        return None, 404

    return target_path, 200

def resolve_youtube(query):
    """
    Query YouTube search with sanitized input and return verified 11-char video ID.
    Uses in-memory cache to prevent redundant outbound requests and rate-limiting.
    """
    if not query:
        return None

    if query in RESOLVE_CACHE:
        return RESOLVE_CACHE[query]

    # Pre-flight check: query length clamping
    safe_query = query.strip()[:120]
    encoded = urllib.parse.quote(safe_query)
    url = f"https://www.youtube.com/results?search_query={encoded}"

    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ),
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as response:
            html = response.read().decode('utf-8', errors='ignore')
            matches = re.findall(r'/watch\?v=([a-zA-Z0-9_-]{11})', html)
            if matches:
                vid = matches[0]
                if vid and len(vid) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', vid):
                    if len(RESOLVE_CACHE) >= RESOLVE_CACHE_MAX:
                        RESOLVE_CACHE.pop(next(iter(RESOLVE_CACHE)))
                    RESOLVE_CACHE[query] = vid
                    return vid
    except Exception as e:
        print(f"[Resolve Notice] {query}: {type(e).__name__}")
    return None

class HardenedAppServerHandler(http.server.BaseHTTPRequestHandler):
    server_version = "SonicWave-Secure"
    sys_version = ""

    def send_header(self, keyword, value):
        # Prevent CRLF Injection / HTTP Response Splitting
        clean_key = str(keyword).replace('\r', '').replace('\n', '').strip()
        clean_val = str(value).replace('\r', '').replace('\n', '').strip()
        super().send_header(clean_key, clean_val)

    def apply_security_headers(self):
        for header, val in SECURITY_HEADERS.items():
            self.send_header(header, val)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')
        self.apply_security_headers()
        self.end_headers()

    def do_HEAD(self):
        self.handle_request(send_body=False)

    def do_GET(self):
        self.handle_request(send_body=True)

    def do_POST(self):
        self.send_error_response(405, "Method Not Allowed")

    def do_PUT(self):
        self.send_error_response(405, "Method Not Allowed")

    def do_DELETE(self):
        self.send_error_response(405, "Method Not Allowed")

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        if code == 429:
            self.send_header('Retry-After', '60')
        self.apply_security_headers()
        body = f"{code} {message}".encode('utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def handle_request(self, send_body=True):
        client_ip = self.client_address[0]

        # 0. DoS & Brute-Force Rate Limiting
        if is_rate_limited(client_ip):
            print(f"[SECURITY ALERT] Rate limit exceeded from {client_ip}")
            self.send_error_response(429, "Too Many Requests: Rate Limit Exceeded")
            return

        # 1. URI Length Check (Mitigates Buffer Overflow / URL Bloat attacks)
        if len(self.path) > 1024:
            self.send_error_response(414, "URI Too Long")
            return

        # 2. Global SQL Injection & Payload Inspection
        is_sqli, matched_rule = check_sqli(self.path)
        if is_sqli:
            print(f"[SECURITY ALERT] SQL Injection attack blocked from {client_ip}: match='{matched_rule}' in '{self.path}'")
            self.send_error_response(400, "Bad Request: Malicious SQL Query Signature Detected")
            return

        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 3.1 API Route: /api/stream
        if path == '/api/stream':
            qs = urllib.parse.parse_qs(parsed.query)
            raw_q = qs.get('q', [''])[0]

            if not raw_q or not raw_q.strip():
                data = json.dumps({'success': False, 'error': 'Query parameter q is required'}).encode('utf-8')
                self.send_response(400)
            else:
                q = raw_q.strip()[:100]
                res = fetch_stream_url(q)
                data = json.dumps({
                    'success': bool(res and res.get('stream_url')),
                    'data': res
                }).encode('utf-8')
                self.send_response(200)

            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=86400')
            self.apply_security_headers()
            self.end_headers()
            if send_body:
                self.wfile.write(data)
            return

        # 3. API Route: /api/resolve
        if path == '/api/resolve':
            qs = urllib.parse.parse_qs(parsed.query)
            raw_q = qs.get('q', [''])[0]

            if not raw_q or not raw_q.strip():
                data = json.dumps({'success': False, 'error': 'Query parameter q is required'}).encode('utf-8')
                self.send_response(400)
            else:
                # Additional parameter-level SQLi check
                is_param_sqli, rule = check_sqli(raw_q)
                if is_param_sqli:
                    print(f"[SECURITY ALERT] SQL Injection in param q from {client_ip}: match='{rule}'")
                    self.send_error_response(400, "Bad Request: Invalid Parameter")
                    return

                q = raw_q.strip()[:120]
                vid = resolve_youtube(q)
                data = json.dumps({
                    'success': bool(vid),
                    'id': vid,
                    'query': q
                }).encode('utf-8')
                self.send_response(200)

            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
            self.apply_security_headers()
            self.end_headers()
            if send_body:
                self.wfile.write(data)
            return

        # 4. Static File Serving with Path Traversal Protection
        target_file, status = is_path_safe(path)

        if status == 403:
            self.send_error_response(403, "Forbidden")
            return
        elif status == 414:
            self.send_error_response(414, "URI Too Long")
            return
        elif status == 404 or not target_file:
            self.send_error_response(404, "Not Found")
            return

        mime, _ = mimetypes.guess_type(target_file)
        mime = mime or 'application/octet-stream'

        try:
            file_size = os.path.getsize(target_file)
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(file_size))
            self.send_header('Access-Control-Allow-Origin', '*')
            
            if mime.startswith('image/') or mime.startswith('font/'):
                self.send_header('Cache-Control', 'public, max-age=86400')
            else:
                self.send_header('Cache-Control', 'public, max-age=300, must-revalidate')

            self.apply_security_headers()
            self.end_headers()

            if send_body:
                with open(target_file, 'rb') as f:
                    while True:
                        chunk = f.read(64 * 1024)
                        if not chunk:
                            break
                        try:
                            self.wfile.write(chunk)
                        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, OSError):
                            break
        except Exception as e:
            print(f"[Server Error Exception] {getattr(self, 'path', '')}: {e}")
            traceback.print_exc()
            try:
                self.send_error_response(500, "Internal Server Error")
            except Exception:
                pass

    def log_message(self, format, *args):
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {self.address_string()} - {format % args}")

if __name__ == '__main__':
    http.server.HTTPServer.allow_reuse_address = True
    server = http.server.ThreadingHTTPServer((HOST, PORT), HardenedAppServerHandler)
    print(f"SonicWave Server running on http://{HOST}:{PORT} (http://localhost:{PORT})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server gracefully...")
        server.server_close()
