#!/usr/bin/env node
/*
 * KIRO-MCP Kiro Bridge (host-side).
 *
 * Runs on the HOST (not in Docker) because it invokes the locally-installed,
 * GitHub-authenticated `kiro-cli`. The backend container calls this bridge over
 * the docker host-gateway. The bridge runs `kiro-cli chat` with the locked-down
 * `kiro_mcp` agent, which can ONLY use the 7 allowlisted MCP item tools.
 *
 * SECURITY:
 *  - User input is passed to kiro-cli as a single argv element via execFile
 *    (NO shell), so shell injection is impossible.
 *  - The agent config restricts tools to the MCP server's 7 item tools; there
 *    is no shell/fs/aws/etc. tool available to the model.
 *  - --trust-tools is pinned to exactly the 7 MCP tools.
 *  - A shared token (X-Bridge-Token) gates access so only the backend can call.
 *  - Per-run timeout + single-flight concurrency limit.
 *  - stdout/stderr are scrubbed of secret-looking substrings before logging.
 */
'use strict';

const http = require('node:http');
const { execFile } = require('node:child_process');

const PORT = Number(process.env.KIRO_BRIDGE_PORT || 3200);
const BIND = process.env.KIRO_BRIDGE_BIND || '0.0.0.0';
const TOKEN = process.env.KIRO_BRIDGE_TOKEN || '';
const AGENT = process.env.KIRO_AGENT || 'kiro_mcp';
const KIRO_BIN = process.env.KIRO_BIN || `${process.env.HOME}/.local/bin/kiro-cli`;
const TIMEOUT_MS = Number(process.env.KIRO_TIMEOUT_MS || 120000);
const MAX_INPUT = 2000;

// Exactly the 7 allowlisted MCP tools (server name is `kiro_mcp`).
const TRUST_TOOLS = [
  'kiro_mcp___list_items',
  'kiro_mcp___get_item',
  'kiro_mcp___create_item',
  'kiro_mcp___update_item',
  'kiro_mcp___delete_item',
  'kiro_mcp___search_items',
  'kiro_mcp___get_statistics',
].join(',');

const SECRET_RE = [
  /(password"?\s*[:=]\s*)("?[^",\s]+)/gi,
  /(token"?\s*[:=]\s*)("?[^",\s]+)/gi,
  /(secret"?\s*[:=]\s*)("?[^",\s]+)/gi,
  /(Bearer\s+)([A-Za-z0-9._-]+)/g,
  /(eyJ[A-Za-z0-9._-]{10,})/g,
];
function scrub(s) {
  let out = String(s || '');
  for (const re of SECRET_RE) out = out.replace(re, (_m, p1) => `${p1 || ''}[REDACTED]`);
  return out;
}

let running = 0; // single-flight concurrency guard

function runKiro(message) {
  return new Promise((resolve) => {
    // execFile => no shell; args passed as an array. Injection-safe.
    const args = [
      'chat',
      '--agent',
      AGENT,
      '--no-interactive',
      `--trust-tools=${TRUST_TOOLS}`,
      message,
    ];
    execFile(
      KIRO_BIN,
      args,
      { timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, env: process.env },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          resolve({ ok: false, error: 'kiro-cli timed out', output: '' });
          return;
        }
        if (err && !stdout) {
          resolve({ ok: false, error: 'kiro-cli failed', output: scrub(stderr).slice(0, 500) });
          return;
        }
        resolve({ ok: true, output: stdout });
      },
    );
  });
}

const server = http.createServer((req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  if (req.method === 'GET' && req.url === '/health') {
    send(200, { status: 'ok' });
    return;
  }
  if (req.method !== 'POST' || req.url !== '/run') {
    send(404, { error: 'not found' });
    return;
  }
  if (TOKEN && req.headers['x-bridge-token'] !== TOKEN) {
    send(401, { error: 'unauthorized' });
    return;
  }
  if (running > 0) {
    send(429, { error: 'busy: another request is being processed' });
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
    } catch {
      send(400, { error: 'invalid JSON' });
      return;
    }
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const correlationId = typeof body.correlationId === 'string' ? body.correlationId : '';
    if (!message) {
      send(400, { error: 'message is required' });
      return;
    }
    if (message.length > MAX_INPUT) {
      send(400, { error: `message too long (max ${MAX_INPUT})` });
      return;
    }

    running += 1;
    const startedAt = Date.now();
    // Log only high-level, scrubbed metadata (no secrets, no full user text).
    console.log(`[bridge] run start cid=${correlationId} len=${message.length}`);
    try {
      const result = await runKiro(message);
      const ms = Date.now() - startedAt;
      console.log(`[bridge] run done cid=${correlationId} ok=${result.ok} ms=${ms}`);
      send(result.ok ? 200 : 502, { ...result, correlationId, durationMs: ms });
    } finally {
      running -= 1;
    }
  });
});

server.listen(PORT, BIND, () => {
  console.log(`[bridge] listening on ${BIND}:${PORT}, agent=${AGENT}, bin=${KIRO_BIN}`);
  console.log(`[bridge] trusted tools: ${TRUST_TOOLS}`);
});
