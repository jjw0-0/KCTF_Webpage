import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.INSTANCER_TOKEN = 'test-token';
process.env.INSTANCER_DATA_DIR = await mkdtemp(path.join(tmpdir(), 'kctf-instancer-state-'));
const { inferManifest, prepareDockerfileDeployment, prepareRuntimeCompose, validateCompose, validateManifest } = await import('../src/index.mjs');

test('prepares a Dockerfile deployment without a Compose build definition', () => {
  const deployment = prepareDockerfileDeployment('simple-web', 'a'.repeat(64), 8080, 'tcp');
  assert.equal(deployment.image, `kctf/simple-web/app:${'a'.repeat(12)}`);
  assert.equal(deployment.compose.services.app.build, undefined);
  assert.equal(deployment.compose.services.app.image, deployment.image);
  assert.equal(deployment.manifest.entryService, 'app');
  assert.equal(deployment.manifest.internalPort, 8080);
  assert.equal(deployment.manifest.protocol, 'tcp');
});

test('infers the entry service from the single administrator-supplied port', () => {
  const compose = validateCompose(`
services:
  web:
    image: node:22-alpine
    ports: ["10008:10008"]
  redis:
    image: redis:7-alpine
`, '/tmp/deployment');
  const manifest = inferManifest(compose, '/tmp/deployment', 10008, 'tcp');
  assert.equal(manifest.entryService, 'web');
  assert.equal(manifest.internalPort, 10008);
  assert.equal(manifest.protocol, 'tcp');
});

test('rejects a port that does not identify exactly one Compose service', () => {
  const compose = validateCompose(`
services:
  web:
    image: node:22-alpine
    ports: ["8080:8080"]
  admin:
    image: node:22-alpine
    expose: ["8080"]
`, '/tmp/deployment');
  assert.throws(() => inferManifest(compose, '/tmp/deployment', 8080), /multiple Compose services/);
  assert.throws(() => inferManifest(compose, '/tmp/deployment', 9000), /no Compose service/);
});

test('accepts a project-local multi-service Compose deployment', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'kctf-compose-'));
  try {
    await mkdir(path.join(root, 'web'));
    await writeFile(path.join(root, 'web', 'Dockerfile'), 'FROM scratch\n');
    const compose = validateCompose(`
services:
  web:
    build: ./web
    depends_on:
      - db
    expose:
      - "8080"
  db:
    image: postgres:16-alpine
    volumes:
      - data:/var/lib/postgresql/data
volumes:
  data: {}
`, root);
    const manifest = validateManifest({
      version: 1,
      runtime: { entryService: 'web', protocol: 'http', port: 8080 },
    }, compose, root);
    assert.equal(manifest.entryService, 'web');
    assert.equal(manifest.internalPort, 8080);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects privileged host access in Compose', () => {
  assert.throws(() => validateCompose(`
services:
  web:
    image: alpine
    privileged: true
    ports: ["8080:8080"]
    volumes: ["/var/run/docker.sock:/var/run/docker.sock"]
`, '/tmp/deployment'), /privileged/);
});

test('accepts declared ports and read-only project files, then owns the runtime port', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'kctf-compose-volume-'));
  try {
    await writeFile(path.join(root, 'redis.conf'), 'protected-mode no\n');
    const compose = validateCompose(`
services:
  web:
    image: alpine
    ports: ["8080:8080"]
    volumes: ["./redis.conf:/etc/redis.conf:ro"]
`, root);
    const manifest = validateManifest({
      version: 1,
      runtime: { entryService: 'web', protocol: 'http', port: 8080 },
    }, compose, root);
    const runtime = prepareRuntimeCompose({ compose, manifest, sourceDir: root, slug: 'test' }, 'token', 21000);
    assert.equal(runtime.services.web.ports, undefined);
    assert.equal(runtime.services.web.volumes[0], `${root}/redis.conf:/etc/redis.conf:ro`);
    assert.deepEqual(runtime.services.web.cap_drop, ['ALL']);
    assert.equal(runtime.networks.default.internal, true);
    assert.equal(runtime.networks.kctf_edge.internal, undefined);
    assert.deepEqual(runtime.services.kctf_gateway.networks, ['default', 'kctf_edge']);
    assert.deepEqual(runtime.services.kctf_gateway.ports, ['0.0.0.0:21000:20000']);
    assert.deepEqual(runtime.services.kctf_gateway.cap_drop, ['ALL']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('applies validated runtime command and environment overrides', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'kctf-compose-override-'));
  try {
    const compose = validateCompose('services:\n  redis:\n    image: redis:7-alpine\n', root);
    const manifest = validateManifest({
      version: 1,
      runtime: {
        entryService: 'redis',
        protocol: 'tcp',
        port: 6379,
        serviceOverrides: { redis: { command: ['redis-server', '--port', '6379'], environment: { QEMU_GUEST_BASE: '0x800000000000' } } },
      },
    }, compose, root);
    const runtime = prepareRuntimeCompose({ compose, manifest, sourceDir: root, slug: 'test' }, 'token', 21000);
    assert.deepEqual(runtime.services.redis.command, ['redis-server', '--port', '6379']);
    assert.equal(runtime.services.redis.environment.QEMU_GUEST_BASE, '0x800000000000');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preserves challenge-provided environment without injecting a flag', () => {
  const compose = validateCompose(`
services:
  web:
    image: alpine
    environment:
      ORIGINAL_FLAG_MODE: static
`, '/tmp/deployment');
  const manifest = validateManifest({
    version: 1,
    runtime: { entryService: 'web', protocol: 'http', port: 8080 },
  }, compose, '/tmp/deployment');
  const runtime = prepareRuntimeCompose({ compose, manifest, sourceDir: '/tmp/deployment', slug: 'test' }, 'token', 21000);
  assert.equal(runtime.services.web.environment.ORIGINAL_FLAG_MODE, 'static');
  assert.equal(runtime.services.web.environment.FLAG, undefined);
  assert.equal(runtime.services.web.volumes, undefined);
});

test('rejects volume driver options that can create host bind mounts', () => {
  assert.throws(() => validateCompose(`
services:
  web:
    image: alpine
    volumes: ["host:/host"]
volumes:
  host:
    driver_opts:
      type: none
      o: bind
      device: /
`, '/tmp/deployment'), /default driver/);
});

test('rejects Compose scaling and resource override controls', () => {
  assert.throws(() => validateCompose(`
services:
  web:
    image: alpine
    deploy:
      replicas: 100
`, '/tmp/deployment'), /deploy/);
});

test('forces named challenge networks internal and reserves the isolated edge network', () => {
  const compose = validateCompose(`
services:
  web:
    image: alpine
    networks: [frontend]
  worker:
    image: alpine
    networks: [frontend, backend]
networks:
  frontend: {}
  backend:
    internal: false
`, '/tmp/deployment');
  const manifest = validateManifest({
    version: 1,
    runtime: { entryService: 'web', protocol: 'http', port: 8080 },
  }, compose, '/tmp/deployment');
  const runtime = prepareRuntimeCompose({ compose, manifest, sourceDir: '/tmp/deployment', slug: 'test' }, 'token', 21000);
  assert.equal(runtime.networks.frontend.internal, true);
  assert.equal(runtime.networks.backend.internal, true);
  assert.deepEqual(runtime.services.kctf_gateway.networks, ['frontend', 'kctf_edge']);
  assert.throws(() => validateCompose(`
services:
  web:
    image: alpine
networks:
  kctf_edge: {}
`, '/tmp/deployment'), /reserved/);
  assert.throws(() => validateCompose(`
services:
  web:
    image: alpine
    networks: [kctf_edge]
`, '/tmp/deployment'), /may not attach to the reserved/);
  compose.services.web.networks = ['kctf_edge'];
  assert.throws(
    () => prepareRuntimeCompose({ compose, manifest, sourceDir: '/tmp/deployment', slug: 'test' }, 'token', 21000),
    /may not attach to the reserved/,
  );
});
