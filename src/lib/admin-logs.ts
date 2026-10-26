import { ACTIVE_CTF_ID } from '@/lib/categories';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, getClientAddress, ipv6ToFallbackIpv4 } from '@/lib/rate-limit';

export type ServerLogLevel = 'INFO' | 'WARN' | 'ERROR';
export type ServerLogSource = 'VM' | 'SUBMIT' | 'AUTH' | 'FILE' | 'USER' | 'ADMIN' | 'SYSTEM' | 'HTTP';

export type ServerLogEntry = {
  id: string;
  timestamp: string;
  level: ServerLogLevel;
  source: ServerLogSource;
  action: string;
  actor: string;
  actorId?: string;
  ip: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  message: string;
  params?: Record<string, unknown>;
};

export type SubmissionLogEntry = {
  id: string;
  submittedAt: string;
  username: string;
  email: string;
  challengeTitle: string;
  category: string;
  points: number;
  isCorrect: boolean;
  flag: string;
};

export type AdminLogsPayload = {
  serverLogs: ServerLogEntry[];
  submissionLogs: SubmissionLogEntry[];
};

const MAX_BUFFER_LOGS = 400;

type GlobalLogState = {
  __kctfServerLogs?: ServerLogEntry[];
  __kctfAuditTableReady?: Promise<boolean>;
};

const globalState = globalThis as unknown as GlobalLogState;

export function extractRequestMeta(
  request?: { headers: Headers; method?: string; url?: string } | null,
  fallbackPath?: string,
) {
  if (!request) {
    return {
      ip: '127.0.0.1',
      userAgent: undefined,
      method: undefined,
      path: fallbackPath,
    };
  }
  const ip = getClientAddress(request.headers);
  const rawUa = request.headers.get('user-agent')?.trim();
  const userAgent = rawUa ? rawUa.slice(0, 240) : undefined;
  let path = fallbackPath;
  if (request.url) {
    try {
      const parsedUrl = new URL(request.url, 'http://localhost');
      path = parsedUrl.pathname + (parsedUrl.search || '');
    } catch {
      path = fallbackPath;
    }
  }
  return {
    ip,
    userAgent,
    method: request.method,
    path,
  };
}

export function extractHeadersMeta(headers: Headers, method = 'GET', path = '/') {
  const ip = getClientAddress(headers);
  const rawUa = headers.get('user-agent')?.trim();
  const userAgent = rawUa ? rawUa.slice(0, 240) : undefined;
  const referer = headers.get('referer')?.trim() || undefined;
  return {
    ip,
    userAgent,
    referer,
    method,
    path,
  };
}

const SENSITIVE_PATH_PATTERNS = [
  /(^|\/)\.(env|git|svn|hg|DS_Store|htaccess|htpasswd|aws|ssh|docker|npmrc|bashrc|profile)/i,
  /(^|\/)(wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|pma|adminer|actuator|jolokia|console|server-status|shell|cmd|eval|vendor\/phpunit)/i,
  /\.(php|asp|aspx|jsp|cgi|sql|bak|old|orig|swp|tar|gz|zip|7z|pem|key|crt|conf|ini|log|yml|yaml|toml)$/i,
  /(etc\/passwd|etc\/shadow|proc\/self|win\.ini|boot\.ini)/i,
  /^\/admin(\/|$)/i,
];

export function isSensitivePathProbe(path: string): boolean {
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export function formatActor(
  user?: {
    id?: string | null;
    username?: string | null;
    email?: string | null;
    instancerId?: number | null;
  } | null,
): string {
  if (!user) return 'anonymous';
  const name = user.username?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email;
  if (user.id) return user.id;
  return 'anonymous';
}

function normalizeActorUsername(rawActor?: string | null): string {
  if (!rawActor) return 'anonymous';
  const trimmed = rawActor.trim();
  if (!trimmed || trimmed === 'system' || trimmed === 'unauthorized') return 'anonymous';
  const idx = trimmed.indexOf(' (');
  return idx > 0 ? trimmed.slice(0, idx) : trimmed;
}

function getBuffer(): ServerLogEntry[] {
  if (!globalState.__kctfServerLogs) {
    globalState.__kctfServerLogs = [];
  }
  return globalState.__kctfServerLogs;
}

async function ensureAuditTable(): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') return false;
  if (!globalState.__kctfAuditTableReady) {
    globalState.__kctfAuditTableReady = (async () => {
      try {
        if (typeof prisma.$executeRawUnsafe !== 'function') return false;
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "audit_logs" (
            "id" TEXT PRIMARY KEY,
            "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "level" TEXT NOT NULL,
            "source" TEXT NOT NULL,
            "action" TEXT NOT NULL,
            "actor" TEXT NOT NULL,
            "actorId" TEXT,
            "ip" TEXT NOT NULL,
            "userAgent" TEXT,
            "method" TEXT,
            "path" TEXT,
            "statusCode" INTEGER,
            "message" TEXT NOT NULL,
            "paramsJson" TEXT
          )
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs" ("timestamp" DESC)
        `);
        return true;
      } catch {
        return false;
      }
    })();
  }
  return globalState.__kctfAuditTableReady;
}

async function persistAuditLog(item: ServerLogEntry): Promise<void> {
  try {
    const ready = await ensureAuditTable();
    if (!ready || typeof prisma.$executeRawUnsafe !== 'function') return;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "audit_logs" (
        "id", "timestamp", "level", "source", "action", "actor", "actorId",
        "ip", "userAgent", "method", "path", "statusCode", "message", "paramsJson"
      ) VALUES ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT ("id") DO NOTHING`,
      item.id,
      item.timestamp,
      item.level,
      item.source,
      item.action,
      item.actor,
      item.actorId ?? null,
      item.ip,
      item.userAgent ?? null,
      item.method ?? null,
      item.path ?? null,
      item.statusCode ?? null,
      item.message,
      item.params ? JSON.stringify(item.params) : null,
    );
  } catch {
    // Never fail request flow if audit persistence fails
  }
}

export function recordServerLog(entry: {
  level?: ServerLogLevel;
  source?: ServerLogSource;
  action?: string;
  actor?: string;
  actorId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  message: string;
  params?: Record<string, unknown>;
  timestamp?: Date | string;
  id?: string;
  request?: { headers: Headers; method?: string; url?: string } | null;
}) {
  const buffer = getBuffer();
  const reqMeta = entry.request ? extractRequestMeta(entry.request, entry.path) : null;
  const ts =
    entry.timestamp instanceof Date
      ? entry.timestamp.toISOString()
      : typeof entry.timestamp === 'string'
        ? entry.timestamp
        : new Date().toISOString();

  const source = entry.source ?? 'HTTP';
  const rawIp = entry.ip ?? reqMeta?.ip ?? '127.0.0.1';
  const item: ServerLogEntry = {
    id: entry.id ?? `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: ts,
    level: entry.level ?? 'INFO',
    source,
    action: entry.action ?? `${source}_EVENT`,
    actor: normalizeActorUsername(entry.actor),
    actorId: entry.actorId,
    ip: ipv6ToFallbackIpv4(rawIp),
    userAgent: entry.userAgent ?? reqMeta?.userAgent,
    method: entry.method ?? reqMeta?.method ?? 'GET',
    path: entry.path ?? reqMeta?.path ?? '/',
    statusCode: entry.statusCode ?? 200,
    message: entry.message,
    params: entry.params,
  };

  buffer.unshift(item);
  if (buffer.length > MAX_BUFFER_LOGS) {
    buffer.length = MAX_BUFFER_LOGS;
  }

  if (item.statusCode === 404 && item.actor === 'anonymous') {
    const persistLimit = consumeRateLimit(`log404:${item.ip}`, 30, 60_000);
    if (!persistLimit.allowed) return;
  }

  void persistAuditLog(item);
}

type PersistedAuditRow = {
  id: string;
  timestamp: Date | string;
  level: string;
  source: string;
  action: string;
  actor: string;
  actorId: string | null;
  ip: string;
  userAgent: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  message: string;
  paramsJson: string | null;
};

async function loadPersistedAuditLogs(): Promise<ServerLogEntry[]> {
  try {
    const ready = await ensureAuditTable();
    if (!ready || typeof prisma.$queryRawUnsafe !== 'function') return [];
    const rows = await prisma.$queryRawUnsafe<PersistedAuditRow[]>(
      `SELECT
        "id", "timestamp", "level", "source", "action", "actor", "actorId",
        "ip", "userAgent", "method", "path", "statusCode", "message", "paramsJson"
      FROM "audit_logs"
      WHERE "source" != 'SYSTEM'
      ORDER BY "timestamp" DESC
      LIMIT 300`,
    );
    return rows.map((row) => {
      let parsedParams: Record<string, unknown> | undefined;
      if (row.paramsJson) {
        try {
          parsedParams = JSON.parse(row.paramsJson) as Record<string, unknown>;
        } catch {
          parsedParams = undefined;
        }
      }
      return {
        id: row.id,
        timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
        level: (row.level as ServerLogLevel) || 'INFO',
        source: (row.source as ServerLogSource) || 'HTTP',
        action: row.action || 'EVENT',
        actor: normalizeActorUsername(row.actor),
        actorId: row.actorId ?? undefined,
        ip: ipv6ToFallbackIpv4(row.ip || '127.0.0.1'),
        userAgent: row.userAgent ?? '-',
        method: row.method ?? 'GET',
        path: row.path ?? '/',
        statusCode: row.statusCode ?? 200,
        message: row.message,
        params: parsedParams,
      };
    });
  } catch {
    return [];
  }
}

export async function getAdminLogs(): Promise<AdminLogsPayload> {
  const [persistedLogs, submissions, instances, challenges] = await Promise.all([
    loadPersistedAuditLogs(),
    prisma.submission.findMany({
      where: { challenge: { ctfId: ACTIVE_CTF_ID } },
      select: {
        id: true,
        challengeId: true,
        userId: true,
        flag: true,
        isCorrect: true,
        submittedAt: true,
        user: { select: { username: true, email: true } },
        challenge: {
          select: {
            title: true,
            points: true,
            category: { select: { shortName: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 200,
    }),
    prisma.challengeInstance.findMany({
      select: {
        id: true,
        userId: true,
        challengeId: true,
        instanceSlug: true,
        url: true,
        createdAt: true,
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.challenge.findMany({
      where: { ctfId: ACTIVE_CTF_ID },
      select: { id: true, title: true, instanceSlug: true },
    }),
  ]);

  const titleById = new Map(challenges.map((c) => [c.id, c.title]));
  const titleBySlug = new Map(
    challenges.filter((c) => c.instanceSlug).map((c) => [c.instanceSlug as string, c.title]),
  );

  const humanizeChallengePath = (rawPath?: string, params?: Record<string, unknown>): string => {
    const path = rawPath ?? '/';
    const paramTitle =
      typeof params?.challengeTitle === 'string'
        ? params.challengeTitle
        : typeof params?.title === 'string'
          ? params.title
          : undefined;

    const challengeRouteMatch = path.match(/^(\/api\/(?:admin\/)?challenges\/)([^/?#]+)(.*)$/);
    if (challengeRouteMatch) {
      const [, prefix, rawId, suffix] = challengeRouteMatch;
      const decodedId = decodeURIComponent(rawId);
      const resolvedTitle = titleById.get(decodedId) ?? titleById.get(rawId) ?? paramTitle;
      if (resolvedTitle) {
        return `${prefix}[${resolvedTitle}]${suffix}`;
      }
    }

    if (path.startsWith('/api/instances')) {
      const chId = typeof params?.challengeId === 'string' ? params.challengeId : undefined;
      const slug = typeof params?.instanceSlug === 'string' ? params.instanceSlug : undefined;
      const resolvedTitle =
        paramTitle ??
        (chId ? titleById.get(chId) : undefined) ??
        (slug ? titleBySlug.get(slug) : undefined);
      if (resolvedTitle && !path.includes('[')) {
        return `/api/instances ([${resolvedTitle}])`;
      }
    }

    return path;
  };

  const submissionLogs: SubmissionLogEntry[] = submissions.map((sub) => ({
    id: sub.id,
    submittedAt: sub.submittedAt.toISOString(),
    username: sub.user.username,
    email: sub.user.email,
    challengeTitle: sub.challenge.title,
    category: sub.challenge.category.shortName,
    points: sub.challenge.points,
    isCorrect: sub.isCorrect,
    flag: sub.flag,
  }));

  const synthesized: ServerLogEntry[] = [];

  for (const inst of instances) {
    const chTitle = titleById.get(inst.challengeId) ?? titleBySlug.get(inst.instanceSlug) ?? inst.instanceSlug;
    synthesized.push({
      id: `vm-inst-${inst.id}`,
      timestamp: inst.createdAt.toISOString(),
      level: 'INFO',
      source: 'VM',
      action: 'VM_CREATE',
      actor: inst.user.username,
      actorId: inst.userId,
      ip: '127.0.0.1',
      userAgent: '-',
      method: 'POST',
      path: `/api/instances ([${chTitle}])`,
      statusCode: 200,
      message: `POST /api/instances ([${chTitle}])`,
    });
  }

  for (const sub of submissions.slice(0, 80)) {
    synthesized.push({
      id: `sub-http-${sub.id}`,
      timestamp: sub.submittedAt.toISOString(),
      level: sub.isCorrect ? 'INFO' : 'WARN',
      source: 'SUBMIT',
      action: 'FLAG_SUBMIT',
      actor: sub.user.username,
      actorId: sub.userId,
      ip: '127.0.0.1',
      userAgent: '-',
      method: 'POST',
      path: `/api/challenges/[${sub.challenge.title}]/submit`,
      statusCode: 200,
      message: `POST /api/challenges/[${sub.challenge.title}]/submit`,
    });
  }

  const combinedMap = new Map<string, ServerLogEntry>();
  for (const item of [...getBuffer(), ...persistedLogs, ...synthesized]) {
    if (item.source === 'SYSTEM') continue;
    if (!combinedMap.has(item.id)) {
      combinedMap.set(item.id, {
        ...item,
        actor: normalizeActorUsername(item.actor),
        ip: ipv6ToFallbackIpv4(item.ip),
        path: humanizeChallengePath(item.path, item.params),
      });
    }
  }

  const serverLogs = Array.from(combinedMap.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 300);

  return { serverLogs, submissionLogs };
}
