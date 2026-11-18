import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';
import test from 'node:test';

const token = 'gateway-test-token';

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('HTTP gateway exchanges a POST token for a cookie and rejects query tokens', async () => {
  const upstream = http.createServer((_request, response) => response.end('challenge'));
  const targetPort = await listen(upstream);
  const portProbe = http.createServer();
  const listenPort = await listen(portProbe);
  await close(portProbe);

  const gateway = spawn(process.execPath, ['gateway/server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      LISTEN_PORT: String(listenPort),
      TARGET_HOST: '127.0.0.1',
      TARGET_PORT: String(targetPort),
      PROTOCOL: 'http',
      ACCESS_TOKEN_HASH: createHash('sha256').update(token).digest('hex'),
    },
    stdio: 'ignore',
  });

  try {
    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 5_000;
      const check = () => fetch(`http://127.0.0.1:${listenPort}/`).then(resolve).catch((error) => {
        if (Date.now() >= deadline) reject(error);
        else setTimeout(check, 25);
      });
      check();
    });

    const queryAttempt = await fetch(`http://127.0.0.1:${listenPort}/?token=${token}`);
    assert.equal(queryAttempt.status, 401);

    const exchange = await fetch(`http://127.0.0.1:${listenPort}/.kctf/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
      redirect: 'manual',
    });
    assert.equal(exchange.status, 303);
    assert.equal(exchange.headers.get('location'), '/');
    const cookie = exchange.headers.get('set-cookie');
    assert.match(cookie, /^kctf_instance_token=[^;]+; HttpOnly; SameSite=Lax; Path=\/$/);

    const authorized = await fetch(`http://127.0.0.1:${listenPort}/`, { headers: { Cookie: cookie.split(';')[0] } });
    assert.equal(authorized.status, 200);
    assert.equal(await authorized.text(), 'challenge');
  } finally {
    gateway.kill();
    await close(upstream);
  }
});
