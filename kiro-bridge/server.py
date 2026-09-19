#!/usr/bin/env python3
"""
KIRO-MCP Kiro Bridge (host-side).

Runs on the HOST (not in Docker) because it invokes the locally-installed,
GitHub-authenticated `kiro-cli`. The backend container calls this bridge over
the docker host-gateway. The bridge runs `kiro-cli chat` with the locked-down
`kiro_mcp` agent, which can ONLY use the 7 allowlisted MCP item tools.

Implemented with the Python 3 standard library only (no extra deps).

SECURITY:
 - User input is passed to kiro-cli as a single argv element via subprocess
   with shell=False (NO shell), so shell injection is impossible.
 - The `kiro_mcp` agent config restricts tools to the MCP server's 7 item
   tools; there is no shell/fs/aws/etc. tool available to the model.
 - --trust-tools is pinned to exactly the 7 MCP tools.
 - A shared token (X-Bridge-Token) gates access so only the backend can call.
 - Per-run timeout + single-flight concurrency lock.
 - stdout/stderr are scrubbed of secret-looking substrings before logging.
"""
import json
import os
import re
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("KIRO_BRIDGE_PORT", "3200"))
BIND = os.environ.get("KIRO_BRIDGE_BIND", "0.0.0.0")
TOKEN = os.environ.get("KIRO_BRIDGE_TOKEN", "")
AGENT = os.environ.get("KIRO_AGENT", "kiro_mcp")
KIRO_BIN = os.environ.get("KIRO_BIN", os.path.expanduser("~/.local/bin/kiro-cli"))
TIMEOUT_S = int(os.environ.get("KIRO_TIMEOUT_MS", "120000")) / 1000.0
MAX_INPUT = 2000

TRUST_TOOLS = ",".join([
    "kiro_mcp___list_items",
    "kiro_mcp___get_item",
    "kiro_mcp___create_item",
    "kiro_mcp___update_item",
    "kiro_mcp___delete_item",
    "kiro_mcp___search_items",
    "kiro_mcp___get_statistics",
])

_SECRET_RES = [
    re.compile(r'(password"?\s*[:=]\s*)("?[^",\s]+)', re.I),
    re.compile(r'(token"?\s*[:=]\s*)("?[^",\s]+)', re.I),
    re.compile(r'(secret"?\s*[:=]\s*)("?[^",\s]+)', re.I),
    re.compile(r'(Bearer\s+)([A-Za-z0-9._-]+)'),
    re.compile(r'(eyJ[A-Za-z0-9._-]{10,})'),
]


def scrub(s: str) -> str:
    out = s or ""
    for rx in _SECRET_RES:
        out = rx.sub(lambda m: (m.group(1) if m.lastindex else "") + "[REDACTED]", out)
    return out


# Single-flight lock: only one kiro-cli run at a time (limits resource use).
_run_lock = threading.Lock()

# Strip ANSI escape codes from kiro-cli output for clean chat display.
_ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[a-zA-Z]")


def run_kiro(message: str):
    args = [
        KIRO_BIN, "chat",
        "--agent", AGENT,
        "--no-interactive",
        "--trust-tools=" + TRUST_TOOLS,
        message,
    ]
    try:
        proc = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_S,
            shell=False,  # injection-safe: args passed as a list
            env=os.environ.copy(),
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "kiro-cli timed out", "output": ""}
    stdout = _ANSI_RE.sub("", proc.stdout or "")
    if proc.returncode != 0 and not stdout.strip():
        return {"ok": False, "error": "kiro-cli failed", "output": scrub(proc.stderr or "")[:500]}
    return {"ok": True, "output": stdout.strip()}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # suppress default noisy logging

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"status": "ok"})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/run":
            self._send(404, {"error": "not found"})
            return
        if TOKEN and self.headers.get("X-Bridge-Token") != TOKEN:
            self._send(401, {"error": "unauthorized"})
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            self._send(400, {"error": "invalid JSON"})
            return
        message = (body.get("message") or "").strip()
        correlation_id = body.get("correlationId") or ""
        if not message:
            self._send(400, {"error": "message is required"})
            return
        if len(message) > MAX_INPUT:
            self._send(400, {"error": f"message too long (max {MAX_INPUT})"})
            return

        if not _run_lock.acquire(blocking=False):
            self._send(429, {"error": "busy: another request is being processed"})
            return
        started = time.time()
        print(f"[bridge] run start cid={correlation_id} len={len(message)}", flush=True)
        try:
            result = run_kiro(message)
        finally:
            _run_lock.release()
        ms = int((time.time() - started) * 1000)
        print(f"[bridge] run done cid={correlation_id} ok={result['ok']} ms={ms}", flush=True)
        result["correlationId"] = correlation_id
        result["durationMs"] = ms
        self._send(200 if result["ok"] else 502, result)


def main():
    print(f"[bridge] listening on {BIND}:{PORT}, agent={AGENT}, bin={KIRO_BIN}", flush=True)
    print(f"[bridge] trusted tools: {TRUST_TOOLS}", flush=True)
    ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
