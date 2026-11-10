import { createHash, timingSafeEqual } from 'node:crypto';
import { appendFile, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';

const listenPort = Number(process.env.LISTEN_PORT || 20_000);
const targetHost = process.env.TARGET_HOST;
const targetPort = Number(process.env.TARGET_PORT);
const protocol = process.env.PROTOCOL || 'http';
const expectedHash = process.env.ACCESS_TOKEN_HASH || '';
const logFile = '/logs/access.jsonl';

if (!targetHost || !targetPort || !/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error('gateway configuration is invalid');

function validToken(value = '') {
  const actual = Buffer.from(createHash('sha256').update(value).digest('hex'));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function log(entry) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    instanceToken: process.env.INSTANCE_TOKEN,
    challengeSlug: process.env.CHALLENGE_SLUG,
    ownerId: process.env.OWNER_ID,
    hostPort: Number(process.env.HOST_PORT),
    ...entry,
  }) + '\n';
  try {
    if ((await stat(logFile).catch(() => ({ size: 0 }))).size > 5 * 1024 * 1024) await writeFile(logFile, '');
    await appendFile(logFile, line);
  } catch {}
  process.stdout.write(line);
}

function clientIp(socket) {
  return socket.remoteAddress?.replace(/^::ffff:/, '') || 'unknown';
}

function safeQuery(url) {
  return Object.fromEntries([...url.searchParams].filter(([key]) => key.toLowerCase() !== 'token'));
}

if (protocol === 'tcp') {
  net.createServer((client) => {
    client.once('data', (chunk) => {
      const newline = chunk.indexOf(10);
      const firstLine = newline >= 0 ? chunk.subarray(0, newline).toString().trim() : '';
      const token = firstLine.startsWith('KCTF_TOKEN ') ? firstLine.slice(11) : '';
      if (!validToken(token)) {
        void log({ protocol: 'tcp', ip: clientIp(client), status: 401 });
        client.end('Unauthorized\n');
        return;
      }
      const upstream = net.connect(targetPort, targetHost, () => {
        if (newline + 1 < chunk.length) upstream.write(chunk.subarray(newline + 1));
        client.pipe(upstream).pipe(client);
        void log({ protocol: 'tcp', ip: clientIp(client), status: 200 });
      });
      upstream.on('error', () => client.destroy());
    });
  }).listen(listenPort, '0.0.0.0');
} else {
  http.createServer((request, response) => {
    const startedAt = Date.now();
    const url = new URL(request.url || '/', 'http://instance');
    const queryToken = url.searchParams.get('token') || '';
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
    const headerToken = String(request.headers['x-kctf-token'] || '');
    const cookieToken = request.headers.cookie?.match(/(?:^|;\s*)kctf_instance_token=([^;]+)/)?.[1] || '';
    const token = queryToken || bearer || headerToken || decodeURIComponent(cookieToken);
    if (!validToken(token)) {
      response.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('Unauthorized: open the instance URL issued by the CTF platform.\n');
      void log({ protocol: 'http', ip: clientIp(request.socket), method: request.method, path: url.pathname, query: safeQuery(url), status: 401, userAgent: request.headers['user-agent'] || '-', durationMs: Date.now() - startedAt });
      return;
    }
    if (queryToken) {
      url.searchParams.delete('token');
      response.writeHead(302, {
        Location: url.pathname + url.search,
        'Set-Cookie': `kctf_instance_token=${encodeURIComponent(queryToken)}; HttpOnly; SameSite=Lax; Path=/`,
        'Cache-Control': 'no-store',
      });
      response.end();
      void log({ protocol: 'http', ip: clientIp(request.socket), method: request.method, path: url.pathname, query: safeQuery(url), status: 302, userAgent: request.headers['user-agent'] || '-', durationMs: Date.now() - startedAt });
      return;
    }

    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size <= 8192) chunks.push(chunk);
    });
    request.on('end', () => {
      const body = Buffer.concat(chunks);
      const headers = { ...request.headers, host: `${targetHost}:${targetPort}`, 'x-forwarded-for': clientIp(request.socket) };
      delete headers.authorization;
      delete headers['x-kctf-token'];
      delete headers.cookie;
      headers['content-length'] = String(body.length);
      const upstream = http.request({ hostname: targetHost, port: targetPort, method: request.method, path: url.pathname + url.search, headers }, (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
        response.on('finish', () => {
          let params;
          const contentType = String(request.headers['content-type'] || '');
          try {
            if (contentType.includes('application/json')) params = JSON.parse(body.toString());
            else if (contentType.includes('application/x-www-form-urlencoded')) params = Object.fromEntries(new URLSearchParams(body.toString()));
          } catch {}
          void log({ protocol: 'http', ip: clientIp(request.socket), method: request.method, path: url.pathname, query: safeQuery(url), params, status: upstreamResponse.statusCode || 502, userAgent: request.headers['user-agent'] || '-', durationMs: Date.now() - startedAt });
        });
      });
      upstream.on('error', () => {
        if (!response.headersSent) response.writeHead(502);
        response.end('Bad Gateway\n');
      });
      upstream.end(body);
    });
  }).listen(listenPort, '0.0.0.0');
}
