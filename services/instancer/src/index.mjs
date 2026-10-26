import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import express from 'express';
import multer from 'multer';
import unzipper from 'unzipper';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const port = readInteger('INSTANCER_PORT', 7000, 1, 65_535);
const bearerToken = required('INSTANCER_TOKEN');
const publicHost = process.env.INSTANCER_PUBLIC_HOST || '127.0.0.1';
const dataDir = path.resolve(process.env.INSTANCER_DATA_DIR || '/data');
const ttlMs = readInteger('INSTANCER_TTL_MS', 60 * 60_000, 60_000, 24 * 60 * 60_000);
const portMin = readInteger('INSTANCER_PORT_MIN', 10_000, 1_024, 65_000);
const portMax = readInteger('INSTANCER_PORT_MAX', 19_999, portMin, 65_535);
const maxUploadBytes = readInteger('INSTANCER_MAX_UPLOAD_BYTES', 50 * 1024 * 1024, 1, 200 * 1024 * 1024);
const maxExtractedBytes = readInteger('INSTANCER_MAX_EXTRACTED_BYTES', 500 * 1024 * 1024, 1, 2 * 1024 * 1024 * 1024);
const maxFiles = readInteger('INSTANCER_MAX_FILES', 5_000, 1, 20_000);
const maxMemoryMb = readInteger('INSTANCER_MAX_MEMORY_MB', 1_024, 64, 16_384);
const maxCpu = readNumber('INSTANCER_MAX_CPU', 2, 0.1, 64);
const maxPids = readInteger('INSTANCER_MAX_PIDS', 256, 16, 4_096);
const buildTimeoutMs = readInteger('INSTANCER_BUILD_TIMEOUT_MS', 10 * 60_000, 30_000, 60 * 60_000);
const installAmd64Emulation = process.env.INSTANCER_INSTALL_AMD64_EMULATION === 'true';
const binfmtImage = process.env.INSTANCER_BINFMT_IMAGE || 'tonistiigi/binfmt@sha256:d3b963f787999e6c0219a48dba02978769286ff61a5f4d26245cb6a6e5567ea3';
const gatewayImage = process.env.INSTANCER_GATEWAY_IMAGE || 'kctf/instance-gateway:1';
const gatewayService = 'kctf_gateway';
const gatewayNetwork = 'kctf_edge';
const gatewayPort = 20_000;
const runtimeVersion = 4;

const deploymentsFile = path.join(dataDir, 'deployments.json');
const instancesFile = path.join(dataDir, 'instances.json');
const deployments = new Map();
const instances = new Map();
let buildQueue = Promise.resolve();
let instanceQueue = Promise.resolve();

await mkdir(dataDir, { recursive: true, mode: 0o700 });
await chmod(dataDir, 0o700);
await loadState(deploymentsFile, deployments);
await loadState(instancesFile, instances);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes, files: 1, fields: 8 },
});

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readInteger(name, fallback, min, max) {
  const value = process.env[name] ? Number(process.env[name]) : fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function readNumber(name, fallback, min, max) {
  const value = process.env[name] ? Number(process.env[name]) : fallback;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

function requireBearer(request, response, next) {
  if (request.header('authorization') !== `Bearer ${bearerToken}`) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

function safeSlug(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(value)) return null;
  return value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadState(filename, target) {
  try {
    const rows = JSON.parse(await readFile(filename, 'utf8'));
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (row && typeof row.slug === 'string') target.set(row.slug, row);
      else if (row && typeof row.token === 'string') target.set(row.token, row);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') console.error(`[state] failed to load ${filename}`, error);
  }
}

async function saveState(filename, values) {
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify([...values.values()], null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, filename);
}

function deploymentResponse(record) {
  if (!record) return null;
  return {
    slug: record.slug,
    mode: record.mode || 'compose',
    status: record.status,
    sourceHash: record.sourceHash,
    error: record.error || null,
    log: record.log || '',
    updatedAt: record.updatedAt,
  };
}

function entryMode(entry) {
  return ((entry.vars?.externalFileAttributes ?? 0) >>> 16) & 0o170000;
}

function archivePermissions(entry) {
  const mode = ((entry.vars?.externalFileAttributes ?? 0) >>> 16) & 0o777;
  return mode & 0o111 ? 0o755 : 0o644;
}

function archiveTarget(root, rawName) {
  const normalized = rawName.replaceAll('\\', '/');
  if (!normalized || normalized.includes('\0') || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`unsafe archive path: ${rawName}`);
  }
  const pieces = normalized.split('/').filter(Boolean);
  if (pieces.some((piece) => piece === '..')) throw new Error(`unsafe archive path: ${rawName}`);
  const resolved = path.resolve(root, ...pieces);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`unsafe archive path: ${rawName}`);
  return resolved;
}

async function extractArchive(buffer, targetDir) {
  const archive = await unzipper.Open.buffer(buffer);
  if (!archive.files.length || archive.files.length > maxFiles) throw new Error(`archive must contain 1-${maxFiles} entries`);
  let totalBytes = 0;
  for (const entry of archive.files) {
    totalBytes += Number(entry.vars?.uncompressedSize || 0);
    if (totalBytes > maxExtractedBytes) throw new Error('archive expands beyond the configured limit');
    if (entryMode(entry) === 0o120000) throw new Error(`symbolic links are not allowed: ${entry.path}`);
    archiveTarget(targetDir, entry.path);
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  for (const entry of archive.files) {
    const destination = archiveTarget(targetDir, entry.path);
    if (entry.type === 'Directory') {
      await mkdir(destination, { recursive: true });
      continue;
    }
    if (entry.type !== 'File') throw new Error(`unsupported archive entry: ${entry.path}`);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await entry.buffer(), { mode: archivePermissions(entry) });
  }
}

function safeRelativePath(root, value, label) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.includes('\0')) {
    throw new Error(`${label} must be a relative path`);
  }
  const resolved = path.resolve(root, value);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`${label} escapes the deployment archive`);
  return resolved;
}

function validateVolume(volume, serviceName, sourceDir) {
  if (typeof volume === 'string') {
    const parts = volume.split(':');
    if (parts.length < 2 || parts.length > 3 || !parts[1]?.startsWith('/')) {
      throw new Error(`${serviceName}.volumes contains an invalid mount`);
    }
    const [source, , options = ''] = parts;
    if (source.startsWith('.')) {
      safeRelativePath(sourceDir, source, `${serviceName}.volumes source`);
      if (!options.split(',').includes('ro')) throw new Error(`${serviceName} bind mounts must be read-only`);
      return;
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(source)) {
      throw new Error(`${serviceName} may only use project files or named volumes`);
    }
    return;
  }
  if (!isPlainObject(volume) || !['volume', 'bind'].includes(volume.type) || typeof volume.source !== 'string') {
    throw new Error(`${serviceName}.volumes contains an unsupported mount`);
  }
  if (volume.type === 'bind') {
    if (!volume.source.startsWith('.') || volume.read_only !== true) {
      throw new Error(`${serviceName} bind mounts must use a project-relative, read-only source`);
    }
    safeRelativePath(sourceDir, volume.source, `${serviceName}.volumes source`);
  } else if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(volume.source)) {
    throw new Error(`${serviceName} contains an invalid named volume`);
  }
}

function validateManifest(raw, compose, sourceDir) {
  if (!isPlainObject(raw) || raw.version !== 1 || !isPlainObject(raw.runtime)) {
    throw new Error('challenge.yaml must contain version: 1 and runtime settings');
  }
  const entryService = raw.runtime.entryService;
  const protocol = raw.runtime.protocol;
  const internalPort = Number(raw.runtime.port);
  if (typeof entryService !== 'string' || !compose.services[entryService]) throw new Error('runtime.entryService must name a Compose service');
  if (!['http', 'tcp'].includes(protocol)) throw new Error('runtime.protocol must be http or tcp');
  if (!Number.isInteger(internalPort) || internalPort < 1 || internalPort > 65_535) throw new Error('runtime.port must be a valid TCP port');

  const defaults = isPlainObject(raw.resources?.defaults) ? raw.resources.defaults : {};
  const resources = {
    memoryMb: Math.min(readManifestNumber(defaults.memoryMb, 256, 64), maxMemoryMb),
    cpu: Math.min(readManifestNumber(defaults.cpu, 0.5, 0.1), maxCpu),
    pids: Math.min(readManifestNumber(defaults.pids, 128, 16, true), maxPids),
  };

  const configuredFlagTargets = Array.isArray(raw.flagTargets) && raw.flagTargets.length
    ? raw.flagTargets
    : [{ service: entryService, name: 'FLAG' }];
  const flagTargets = configuredFlagTargets.map((target) => {
    if (!isPlainObject(target) || typeof target.service !== 'string' || !compose.services[target.service]) {
      throw new Error('each flag target must name a Compose service');
    }
    if (target.mode === 'file') {
      if (typeof target.path !== 'string' || !target.path.startsWith('/') || target.path.includes('\0')) {
        throw new Error('file flag targets require an absolute container path');
      }
      return { service: target.service, mode: 'file', path: target.path };
    }
    if (target.mode !== undefined && target.mode !== 'env') throw new Error('flag target mode must be env or file');
    const name = typeof target.name === 'string' ? target.name : 'FLAG';
    if (!/^[A-Z_][A-Z0-9_]{0,63}$/.test(name)) throw new Error('flag environment variable names must be uppercase identifiers');
    return { service: target.service, mode: 'env', name };
  });

  const composeFile = typeof raw.runtime.composeFile === 'string' ? raw.runtime.composeFile : 'docker-compose.yml';
  const serviceOverrides = validateServiceOverrides(raw.runtime.serviceOverrides, compose);
  safeRelativePath(sourceDir, composeFile, 'runtime.composeFile');
  return { entryService, protocol, internalPort, resources, flagTargets, composeFile, serviceOverrides };
}

function composePortTarget(value) {
  if (Number.isInteger(value)) return value;
  if (isPlainObject(value)) return Number(value.target);
  if (typeof value !== 'string') return NaN;
  const match = value.match(/(?:^|:)(\d+)(?:\/(?:tcp|udp))?$/);
  return match ? Number(match[1]) : NaN;
}

function inferManifest(compose, sourceDir, entryPort) {
  if (!Number.isInteger(entryPort) || entryPort < 1 || entryPort > 65_535) {
    throw new Error('entryPort must be a valid TCP port');
  }
  const matches = Object.entries(compose.services).filter(([, service]) => [
    ...(Array.isArray(service.ports) ? service.ports : []),
    ...(Array.isArray(service.expose) ? service.expose : []),
  ].some((declared) => composePortTarget(declared) === entryPort));
  if (matches.length !== 1) {
    throw new Error(matches.length
      ? `entry port ${entryPort} is declared by multiple Compose services`
      : `no Compose service declares entry port ${entryPort}`);
  }
  return validateManifest({
    version: 1,
    runtime: {
      composeFile: 'docker-compose.yml',
      entryService: matches[0][0],
      protocol: 'http',
      port: entryPort,
    },
  }, compose, sourceDir);
}

function prepareDockerfileDeployment(slug, hash, entryPort) {
  if (!Number.isInteger(entryPort) || entryPort < 1 || entryPort > 65_535) {
    throw new Error('entryPort must be a valid TCP port');
  }
  const image = `kctf/${slug}/app:${hash.slice(0, 12)}`;
  return {
    image,
    compose: { services: { app: { image } } },
    manifest: {
      entryService: 'app',
      protocol: 'http',
      internalPort: entryPort,
      resources: { memoryMb: Math.min(256, maxMemoryMb), cpu: Math.min(0.5, maxCpu), pids: Math.min(128, maxPids) },
      flagTargets: [{ service: 'app', mode: 'env', name: 'FLAG' }],
      composeFile: null,
      serviceOverrides: {},
    },
  };
}

async function automaticCompatibilityOverrides(compose, sourceDir) {
  if (process.arch !== 'arm64') return {};
  const overrides = {};
  for (const [serviceName, service] of Object.entries(compose.services)) {
    if (!service.build) continue;
    const build = typeof service.build === 'string' ? { context: service.build } : service.build;
    const contextPath = safeRelativePath(sourceDir, build.context, `${serviceName}.build.context`);
    const dockerfilePath = safeRelativePath(contextPath, build.dockerfile || 'Dockerfile', `${serviceName}.build.dockerfile`);
    const dockerfile = await readFile(dockerfilePath, 'utf8');
    if (!/\bvulhub\/redis:5\.0\.7\b/.test(dockerfile)) continue;
    const redisPort = Number(dockerfile.match(/redis-server[\s\S]*?--port\s+(\d+)/)?.[1] || 6379);
    overrides[serviceName] = {
      command: ['redis-server', '--protected-mode', 'no', '--bind', '0.0.0.0', '--port', String(redisPort)],
      environment: { QEMU_GUEST_BASE: '0x800000000000' },
    };
  }
  return overrides;
}

function validateServiceOverrides(raw, compose) {
  if (raw === undefined) return {};
  if (!isPlainObject(raw)) throw new Error('runtime.serviceOverrides must be an object');
  const result = {};
  for (const [serviceName, override] of Object.entries(raw)) {
    if (!compose.services[serviceName] || !isPlainObject(override)
      || Object.keys(override).some((key) => !['command', 'environment'].includes(key))) {
      throw new Error(`invalid runtime override for ${serviceName}`);
    }
    const command = override.command;
    const validCommand = command === undefined || (typeof command === 'string'
      ? command.length > 0 && command.length <= 2_000
      : Array.isArray(command) && command.length > 0 && command.length <= 50
        && command.every((item) => typeof item === 'string' && item.length <= 500));
    if (!validCommand) throw new Error(`${serviceName} runtime command is invalid`);
    const environment = override.environment;
    const validEnvironment = environment === undefined || (isPlainObject(environment)
      && Object.keys(environment).length <= 50
      && Object.entries(environment).every(([key, value]) => /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key)
        && ['string', 'number', 'boolean'].includes(typeof value) && String(value).length <= 1_000));
    if (!validEnvironment) throw new Error(`${serviceName} runtime environment is invalid`);
    if (command === undefined && environment === undefined) throw new Error(`${serviceName} runtime override is empty`);
    result[serviceName] = {
      ...(command === undefined ? {} : { command: clone(command) }),
      ...(environment === undefined ? {} : { environment: clone(environment) }),
    };
  }
  return result;
}

function readManifestNumber(value, fallback, minimum, integer = false) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number < minimum || (integer && !Number.isInteger(number))) {
    throw new Error('challenge resource limits are invalid');
  }
  return number;
}

const deniedServiceKeys = [
  'privileged', 'network_mode', 'pid', 'ipc', 'uts', 'userns_mode', 'devices',
  'cap_add', 'cgroup_parent', 'cgroup', 'sysctls', 'volumes_from',
  'extra_hosts', 'extends', 'profiles', 'secrets', 'configs', 'gpus', 'runtime',
  'device_cgroup_rules', 'oom_kill_disable', 'storage_opt', 'ulimits', 'logging',
  'labels', 'deploy', 'develop', 'pull_policy', 'scale', 'shm_size', 'tmpfs',
  'credential_spec',
];

function validateCompose(rawText, sourceDir) {
  if (rawText.includes('${')) throw new Error('Compose environment interpolation is not allowed');
  const compose = parseYaml(rawText);
  if (!isPlainObject(compose) || !isPlainObject(compose.services)) throw new Error('docker-compose.yml must define services');
  const serviceEntries = Object.entries(compose.services);
  if (!serviceEntries.length || serviceEntries.length > 10) throw new Error('Compose must define 1-10 services');
  if ('include' in compose) throw new Error('Compose include is not allowed');
  if (gatewayService in compose.services) throw new Error(`${gatewayService} is reserved by the instancer`);

  for (const [name, service] of serviceEntries) {
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(name) || !isPlainObject(service)) throw new Error(`invalid Compose service: ${name}`);
    for (const key of deniedServiceKeys) {
      if (key in service) throw new Error(`${name}.${key} is not allowed`);
    }
    if ('env_file' in service) throw new Error(`${name}.env_file is not allowed; use environment instead`);
    if (!service.build && !service.image) throw new Error(`${name} must define build or image`);
    const serviceNetworks = Array.isArray(service.networks)
      ? service.networks
      : isPlainObject(service.networks)
        ? Object.keys(service.networks)
        : [];
    if (serviceNetworks.includes(gatewayNetwork)) {
      throw new Error(`${name} may not attach to the reserved ${gatewayNetwork} network`);
    }

    if (service.build) {
      const build = typeof service.build === 'string' ? { context: service.build } : service.build;
      if (!isPlainObject(build) || typeof build.context !== 'string') throw new Error(`${name}.build.context is required`);
      if (build.additional_contexts || build.ssh || build.secrets || build.network || build.entitlements || build.cache_from || build.cache_to) {
        throw new Error(`${name}.build contains unsupported privileged inputs`);
      }
      const contextPath = safeRelativePath(sourceDir, build.context, `${name}.build.context`);
      if (build.dockerfile) safeRelativePath(contextPath, build.dockerfile, `${name}.build.dockerfile`);
    }

    if (service.volumes) {
      if (!Array.isArray(service.volumes)) throw new Error(`${name}.volumes must be a list`);
      for (const volume of service.volumes) validateVolume(volume, name, sourceDir);
    }
  }

  if ('name' in compose) throw new Error('a global Compose project name is not allowed');
  if (compose.volumes) {
    if (!isPlainObject(compose.volumes)) throw new Error('Compose volumes must be an object');
    for (const [name, definition] of Object.entries(compose.volumes)) {
      if (definition && (!isPlainObject(definition) || Object.keys(definition).length > 0)) {
        throw new Error(`volume ${name} must be project-local and use the default driver`);
      }
    }
  }
  if (compose.networks) {
    if (!isPlainObject(compose.networks)) throw new Error('Compose networks must be an object');
    for (const [name, definition] of Object.entries(compose.networks)) {
      if (name === gatewayNetwork) throw new Error(`${gatewayNetwork} is reserved by the instancer`);
      if (!definition) continue;
      if (!isPlainObject(definition) || definition.external || definition.name || definition.driver_opts || definition.ipam) {
        throw new Error(`network ${name} contains unsafe settings`);
      }
      if (definition.driver && definition.driver !== 'bridge') throw new Error(`network ${name} must use the bridge driver`);
      const allowed = new Set(['driver', 'internal', 'attachable']);
      if (Object.keys(definition).some((key) => !allowed.has(key))) throw new Error(`network ${name} contains unsupported settings`);
    }
  }
  return compose;
}

function deploymentPaths(slug, hash) {
  const root = path.join(dataDir, 'deployments', slug, hash);
  return {
    root,
    source: path.join(root, 'source'),
    buildCompose: path.join(root, 'source', '.kctf-build-compose.yml'),
  };
}

function prepareBuildCompose(compose, slug, hash) {
  const output = clone(compose);
  for (const [serviceName, service] of Object.entries(output.services)) {
    if (service.build) service.image = `kctf/${slug}/${serviceName}:${hash.slice(0, 12)}`;
  }
  return output;
}

function prepareRuntimeCompose(record, token, hostPort, flag, flagFile) {
  const output = clone(record.compose);
  for (const [serviceName, service] of Object.entries(output.services)) {
    const attachedNetworks = Array.isArray(service.networks)
      ? service.networks
      : isPlainObject(service.networks)
        ? Object.keys(service.networks)
        : [];
    if (attachedNetworks.includes(gatewayNetwork)) {
      throw new Error(`${serviceName} may not attach to the reserved ${gatewayNetwork} network`);
    }
    delete service.build;
    delete service.ports;
    delete service.container_name;
    if (record.manifest.serviceOverrides[serviceName]) {
      const override = record.manifest.serviceOverrides[serviceName];
      if (override.command !== undefined) service.command = clone(override.command);
      if (override.environment) service.environment = { ...normalizeEnvironment(service.environment), ...clone(override.environment) };
    }
    if (service.volumes) {
      service.volumes = service.volumes.map((volume) => runtimeVolume(volume, record.sourceDir));
    }
    service.restart = 'no';
    service.mem_limit = `${record.manifest.resources.memoryMb}m`;
    service.cpus = String(record.manifest.resources.cpu);
    service.pids_limit = record.manifest.resources.pids;
    service.labels = {
      ...(isPlainObject(service.labels) ? service.labels : {}),
      'kctf.role': 'challenge-instance',
      'kctf.instance': token,
      'kctf.challenge': record.slug,
    };
    service.security_opt = ['no-new-privileges:true'];
    service.cap_drop = ['ALL'];
    if (flag) {
      const targets = record.manifest.flagTargets.filter((target) => target.service === serviceName);
      for (const target of targets) {
        if (target.mode === 'file') {
          service.volumes = (service.volumes ?? []).filter((volume) => volumeTarget(volume) !== target.path);
          service.volumes.push({ type: 'bind', source: flagFile, target: target.path, read_only: true });
        } else {
          service.environment = normalizeEnvironment(service.environment);
          service.environment[target.name] = flag;
        }
      }
    }
  }

  output.networks = isPlainObject(output.networks) ? output.networks : {};
  for (const [name, definition] of Object.entries(output.networks)) {
    output.networks[name] = { ...(isPlainObject(definition) ? definition : {}), driver: 'bridge', internal: true };
  }

  const entry = output.services[record.manifest.entryService];
  const entryNetworks = Array.isArray(entry.networks)
    ? entry.networks
    : isPlainObject(entry.networks)
      ? Object.keys(entry.networks)
      : ['default'];
  const entryNetwork = entryNetworks[0] || 'default';
  if (!output.networks[entryNetwork]) {
    if (entryNetwork !== 'default') throw new Error(`entry service references undefined network: ${entryNetwork}`);
    output.networks.default = { driver: 'bridge', internal: true };
  }
  output.networks[gatewayNetwork] = { driver: 'bridge' };
  output.services[gatewayService] = {
    image: gatewayImage,
    command: [
      `TCP-LISTEN:${gatewayPort},fork,reuseaddr`,
      `TCP:${record.manifest.entryService}:${record.manifest.internalPort}`,
    ],
    depends_on: [record.manifest.entryService],
    networks: [entryNetwork, gatewayNetwork],
    ports: [`0.0.0.0:${hostPort}:${gatewayPort}`],
    restart: 'no',
    read_only: true,
    mem_limit: '32m',
    cpus: '0.1',
    pids_limit: 32,
    cap_drop: ['ALL'],
    security_opt: ['no-new-privileges:true'],
    labels: {
      'kctf.role': 'instance-gateway',
      'kctf.instance': token,
      'kctf.challenge': record.slug,
    },
  };
  return output;
}

function volumeTarget(volume) {
  if (typeof volume === 'string') return volume.split(':')[1];
  return volume.target;
}

function runtimeVolume(volume, sourceDir) {
  if (typeof volume === 'string') {
    const parts = volume.split(':');
    if (parts[0].startsWith('.')) parts[0] = safeRelativePath(sourceDir, parts[0], 'volume source');
    return parts.join(':');
  }
  if (volume.type === 'bind') return { ...volume, source: safeRelativePath(sourceDir, volume.source, 'volume source') };
  return volume;
}

function normalizeEnvironment(environment) {
  if (!environment) return {};
  if (isPlainObject(environment)) return environment;
  if (Array.isArray(environment)) {
    return Object.fromEntries(environment.map((item) => {
      const index = String(item).indexOf('=');
      return index < 0 ? [String(item), ''] : [String(item).slice(0, index), String(item).slice(index + 1)];
    }));
  }
  throw new Error('service environment must be an object or list');
}

async function run(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const append = (chunk) => {
      output += chunk.toString('utf8');
      if (output.length > 250_000) output = output.slice(-250_000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(`${command} failed (${signal || code})\n${output}`));
    });
  });
}

async function buildDeployment(slug) {
  const record = deployments.get(slug);
  if (!record) return;
  record.status = 'BUILDING';
  record.error = null;
  record.updatedAt = new Date().toISOString();
  await saveState(deploymentsFile, deployments);
  try {
    const output = (record.mode || 'compose') === 'dockerfile'
      ? await run('docker', ['build', '--pull', '-t', record.image, '.'], {
          cwd: record.sourceDir,
          timeoutMs: buildTimeoutMs,
        })
      : await run('docker', ['compose', '-f', record.buildCompose, 'build', '--pull'], {
          cwd: record.sourceDir,
          timeoutMs: buildTimeoutMs,
        });
    if ((record.mode || 'compose') === 'compose') {
      await run('docker', ['compose', '-f', record.buildCompose, 'pull', '--ignore-buildable'], {
        cwd: record.sourceDir,
        timeoutMs: buildTimeoutMs,
      });
    }
    record.status = 'READY';
    record.log = output.slice(-100_000);
  } catch (error) {
    record.status = 'FAILED';
    record.error = error instanceof Error ? error.message.slice(-20_000) : String(error);
    record.log = record.error;
  }
  record.updatedAt = new Date().toISOString();
  await saveState(deploymentsFile, deployments);
}

function enqueueBuild(slug) {
  buildQueue = buildQueue.then(() => buildDeployment(slug), () => buildDeployment(slug));
}

async function pickHostPort() {
  const used = new Set([...instances.values()].map((instance) => instance.hostPort));
  const published = await run('docker', ['ps', '--format', '{{.Ports}}'], { timeoutMs: 10_000 }).catch(() => '');
  for (const match of published.matchAll(/:(\d+)->/g)) used.add(Number(match[1]));
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = portMin + Math.floor(Math.random() * (portMax - portMin + 1));
    if (used.has(candidate)) continue;
    return candidate;
  }
  throw new Error('no free challenge port is available');
}

function activeForUser(userId) {
  return [...instances.values()].find((instance) => instance.userId === userId && instance.status === 'RUNNING');
}

function withInstanceLock(operation) {
  const result = instanceQueue.then(operation, operation);
  instanceQueue = result.catch(() => undefined);
  return result;
}

async function instanceIsRunning(instance) {
  const output = await run('docker', ['compose', '-p', instance.projectName, '-f', instance.composeFile, 'ps', '--status', 'running', '--services'], {
    cwd: path.dirname(instance.composeFile),
    timeoutMs: 10_000,
  }).catch(() => '');
  return output.trim().split('\n').filter(Boolean).length >= (instance.serviceCount || 1);
}

async function waitForProjectServices(projectName, composeFile, serviceCount) {
  let stableChecks = 0;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const output = await run('docker', ['compose', '-p', projectName, '-f', composeFile, 'ps', '--status', 'running', '--services'], {
      cwd: path.dirname(composeFile),
      timeoutMs: 10_000,
    }).catch(() => '');
    const running = output.trim().split('\n').filter(Boolean).length;
    stableChecks = running >= serviceCount ? stableChecks + 1 : 0;
    if (stableChecks >= 3) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

async function destroyInstance(instance) {
  try {
    await run('docker', ['compose', '-p', instance.projectName, '-f', instance.composeFile, 'down', '-v', '--remove-orphans'], {
      cwd: path.dirname(instance.composeFile),
      timeoutMs: 60_000,
    });
  } finally {
    instances.delete(instance.token);
    await saveState(instancesFile, instances);
    await rm(path.dirname(instance.composeFile), { recursive: true, force: true });
  }
}

async function removeBuiltImages(record) {
  if ((record.mode || 'compose') === 'dockerfile') {
    await run('docker', ['image', 'rm', record.image], { timeoutMs: 60_000 }).catch(() => undefined);
    return;
  }
  const prefix = `kctf/${record.slug}/`;
  const images = [...new Set(Object.values(record.compose.services)
    .map((service) => service.image)
    .filter((image) => typeof image === 'string' && image.startsWith(prefix)))];
  await Promise.all(images.map((image) => run('docker', ['image', 'rm', image], { timeoutMs: 60_000 }).catch(() => undefined)));
}

app.get('/healthz', (_request, response) => response.status(200).send('ok'));

app.get('/api/instancer/status', requireBearer, (_request, response) => {
  response.json({ active: [...instances.values()].filter((instance) => instance.status === 'RUNNING').length, capacity: null });
});

app.post('/api/instancer/deployments/:slug', requireBearer, upload.single('bundle'), async (request, response) => {
  const slug = safeSlug(request.params.slug);
  if (!slug) return response.status(400).json({ error: 'invalid deployment slug' });
  if (!request.file?.buffer?.length || !request.file.originalname.toLowerCase().endsWith('.zip')) {
    return response.status(400).json({ error: 'a deployment ZIP is required' });
  }
  const sourceHash = createHash('sha256').update(request.file.buffer).digest('hex');
  const entryPort = Number(request.body?.entryPort);
  const mode = request.body?.mode;
  if (!['compose', 'dockerfile'].includes(mode)) return response.status(400).json({ error: 'deployment mode must be compose or dockerfile' });
  const paths = deploymentPaths(slug, sourceHash);
  try {
    await extractArchive(request.file.buffer, paths.source);
    let compose;
    let manifest;
    let buildCompose = null;
    let image = null;
    if (mode === 'compose') {
      const manifestPath = path.join(paths.source, 'challenge.yaml');
      const manifestRaw = await readFile(manifestPath, 'utf8').then(parseYaml).catch((error) => {
        if (error?.code === 'ENOENT') return null;
        throw error;
      });
      const composeFilename = manifestRaw?.runtime?.composeFile || 'docker-compose.yml';
      const composePath = safeRelativePath(paths.source, composeFilename, 'runtime.composeFile');
      const composeRaw = await readFile(composePath, 'utf8');
      compose = validateCompose(composeRaw, paths.source);
      manifest = manifestRaw
        ? validateManifest(manifestRaw, compose, paths.source)
        : inferManifest(compose, paths.source, entryPort);
      manifest.serviceOverrides = {
        ...await automaticCompatibilityOverrides(compose, paths.source),
        ...manifest.serviceOverrides,
      };
      buildCompose = prepareBuildCompose(compose, slug, sourceHash);
      await writeFile(paths.buildCompose, stringifyYaml(buildCompose), { mode: 0o600 });
    } else {
      await readFile(path.join(paths.source, 'Dockerfile'), 'utf8');
      ({ compose, manifest, image } = prepareDockerfileDeployment(slug, sourceHash, entryPort));
    }
    const record = {
      slug,
      mode,
      status: 'QUEUED',
      sourceHash,
      sourceDir: paths.source,
      buildCompose: mode === 'compose' ? paths.buildCompose : null,
      image,
      compose: mode === 'compose' ? buildCompose : compose,
      manifest,
      log: '',
      error: null,
      updatedAt: new Date().toISOString(),
    };
    deployments.set(slug, record);
    await saveState(deploymentsFile, deployments);
    enqueueBuild(slug);
    return response.status(202).json({ deployment: deploymentResponse(record) });
  } catch (error) {
    await rm(paths.root, { recursive: true, force: true }).catch(() => undefined);
    return response.status(400).json({ error: error instanceof Error ? error.message : 'invalid deployment bundle' });
  }
});

app.get('/api/instancer/deployments/:slug', requireBearer, (request, response) => {
  const slug = safeSlug(request.params.slug);
  const record = slug ? deployments.get(slug) : null;
  if (!record) return response.status(404).json({ error: 'deployment not found' });
  return response.json({ deployment: deploymentResponse(record) });
});

app.delete('/api/instancer/deployments/:slug', requireBearer, async (request, response) => {
  const slug = safeSlug(request.params.slug);
  const record = slug ? deployments.get(slug) : null;
  if (!record) return response.status(204).end();
  const running = [...instances.values()].filter((instance) => instance.slug === slug);
  await Promise.all(running.map((instance) => destroyInstance(instance)));
  await removeBuiltImages(record);
  deployments.delete(slug);
  await saveState(deploymentsFile, deployments);
  await rm(path.join(dataDir, 'deployments', slug), { recursive: true, force: true });
  return response.status(204).end();
});

app.post('/api/instancer/create', requireBearer, async (request, response) => {
  const slug = safeSlug(request.body?.slug);
  const userId = Number(request.body?.user_id);
  const flag = typeof request.body?.flag === 'string' ? request.body.flag : undefined;
  if (!slug) return response.status(400).json({ error: 'unknown slug' });
  if (!Number.isInteger(userId) || userId <= 0) return response.status(400).json({ error: 'user_id must be a positive integer' });
  if (flag !== undefined && (!flag || flag.length > 256)) return response.status(400).json({ error: 'the per-player flag is invalid' });
  const deployment = deployments.get(slug);
  if (!deployment || deployment.status !== 'READY') return response.status(409).json({ error: 'deployment is not ready' });

  try {
    return await withInstanceLock(async () => {
      const existing = activeForUser(userId);
      if (existing?.slug === slug && await instanceIsRunning(existing)) {
        return response.json({ token: existing.token, url: existing.url, expires_at: existing.expiresAt });
      }
      if (existing) await destroyInstance(existing);

      const token = randomBytes(8).toString('hex');
      const hostPort = await pickHostPort();
      const projectName = `kctf-i-${token}`;
      const instanceDir = path.join(dataDir, 'instances', token);
      const composeFile = path.join(instanceDir, 'compose.yml');
      const flagFile = path.join(instanceDir, 'flag');
      await mkdir(instanceDir, { recursive: true, mode: 0o700 });
      if (flag) await writeFile(flagFile, `${flag}\n`, { mode: 0o444 });
      const runtimeCompose = prepareRuntimeCompose(deployment, token, hostPort, flag, flagFile);
      await writeFile(composeFile, stringifyYaml(runtimeCompose), { mode: 0o600 });
      try {
        await run('docker', ['compose', '-p', projectName, '-f', composeFile, 'up', '-d', '--no-build'], {
          cwd: instanceDir,
          timeoutMs: 90_000,
        });
        const serviceCount = Object.keys(runtimeCompose.services).length;
        if (!await waitForProjectServices(projectName, composeFile, serviceCount)) {
          throw new Error('one or more challenge services exited during startup');
        }
      } catch (error) {
        await run('docker', ['compose', '-p', projectName, '-f', composeFile, 'down', '-v', '--remove-orphans'], { cwd: instanceDir }).catch(() => undefined);
        await rm(instanceDir, { recursive: true, force: true });
        return response.status(500).json({ error: error instanceof Error ? error.message.slice(-2_000) : 'instance failed to start' });
      }

      const scheme = deployment.manifest.protocol === 'http' ? 'http' : 'tcp';
      const url = `${scheme}://${publicHost}:${hostPort}${scheme === 'http' ? '/' : ''}`;
      const instance = {
        token,
        slug,
        userId,
        hostPort,
        projectName,
        composeFile,
        status: 'RUNNING',
        url,
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
        serviceCount: Object.keys(runtimeCompose.services).length,
        runtimeVersion,
      };
      instances.set(token, instance);
      await saveState(instancesFile, instances);
      return response.status(201).json({ token, url, expires_at: instance.expiresAt });
    });
  } catch (error) {
    console.error('[instance:create]', error);
    return response.status(500).json({ error: error instanceof Error ? error.message.slice(-2_000) : 'instance failed to start' });
  }
});

app.delete('/api/instancer/destroy/:token', requireBearer, async (request, response) => {
  const instance = instances.get(request.params.token);
  if (!instance) return response.status(404).json({ error: 'instance not found' });
  await destroyInstance(instance);
  return response.status(204).end();
});

app.use((error, _request, response, _next) => {
  void _next;
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ error: 'deployment ZIP is too large' });
    return;
  }
  console.error(error);
  response.status(500).json({ error: 'internal instancer error' });
});

export { inferManifest, prepareDockerfileDeployment, prepareRuntimeCompose, validateCompose, validateManifest };

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  if (installAmd64Emulation && process.arch === 'arm64') {
    console.log('[instancer] registering amd64 emulation');
    await run('docker', ['run', '--privileged', '--rm', binfmtImage, '--install', 'amd64'], { timeoutMs: 120_000 });
  }

  const gatewayContext = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../gateway');
  await run('docker', ['image', 'inspect', gatewayImage], { timeoutMs: 10_000 }).catch(async () => {
    console.log(`[instancer] building isolated gateway image ${gatewayImage}`);
    await run('docker', ['build', '--pull', '-t', gatewayImage, gatewayContext], { timeoutMs: buildTimeoutMs });
  });

  for (const instance of [...instances.values()]) {
    if (instance.runtimeVersion !== runtimeVersion) {
      console.log(`[instancer] removing legacy unisolated instance ${instance.token}`);
      await destroyInstance(instance).catch((error) => console.error('[startup-cleanup]', error));
    }
  }

  setInterval(() => {
    const now = Date.now();
    for (const instance of instances.values()) {
      if (Date.parse(instance.expiresAt) <= now) void destroyInstance(instance).catch((error) => console.error('[cleanup]', error));
    }
  }, 30_000).unref();

  for (const record of deployments.values()) {
    if (record.status === 'QUEUED' || record.status === 'BUILDING') enqueueBuild(record.slug);
  }

  app.listen(port, '0.0.0.0', () => console.log(`[instancer] listening on :${port}`));
}
