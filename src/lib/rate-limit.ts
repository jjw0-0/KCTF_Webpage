type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

type GlobalIpMapState = {
  __kctfIpv4Map?: Map<string, string>;
};

const globalIpState = globalThis as unknown as GlobalIpMapState;

function getIpv4Map(): Map<string, string> {
  if (!globalIpState.__kctfIpv4Map) {
    globalIpState.__kctfIpv4Map = new Map<string, string>();
  }
  return globalIpState.__kctfIpv4Map;
}

const IPV4_EXACT_RE = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV4_EXTRACT_RE = /\b((?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3})\b/;

export function isValidIpv4(value: string): boolean {
  return IPV4_EXACT_RE.test(value.trim());
}

export function getIpv6Prefix64(ip: string): string | null {
  const clean = ip.trim().toLowerCase();
  if (!clean.includes(':')) return null;
  const parts = clean.split(':').filter(Boolean);
  if (parts.length < 4) return null;
  return parts.slice(0, 4).join(':');
}

export function registerClientIpv4(rawConnectingIp: string, ipv4: string) {
  if (!isValidIpv4(ipv4)) return;
  const map = getIpv4Map();
  const cleanRaw = rawConnectingIp.trim().toLowerCase();
  if (cleanRaw) {
    map.set(cleanRaw, ipv4.trim());
    const prefix = getIpv6Prefix64(cleanRaw);
    if (prefix) {
      map.set(`prefix64:${prefix}`, ipv4.trim());
    }
  }
}

export function ipv6ToFallbackIpv4(ip: string): string {
  const clean = ip.trim().toLowerCase();
  if (!clean) return '127.0.0.1';
  if (isValidIpv4(clean)) return clean;
  if (clean.startsWith('::ffff:')) {
    const mapped = clean.slice(7);
    if (isValidIpv4(mapped)) return mapped;
  }
  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1' || clean === 'localhost' || clean === 'internal' || clean === 'recorded-in-db' || clean === 'unknown') {
    return '127.0.0.1';
  }
  const map = getIpv4Map();
  const direct = map.get(clean);
  if (direct) return direct;
  const prefix = getIpv6Prefix64(clean);
  if (prefix) {
    const byPrefix = map.get(`prefix64:${prefix}`);
    if (byPrefix) return byPrefix;
  }
  const match = clean.match(IPV4_EXTRACT_RE);
  if (match) return match[1];

  // Fallback deterministic IPv4 representation from IPv6 words if real IPv4 not yet synced
  const hexGroups = clean.split(':').filter(Boolean);
  if (hexGroups.length >= 2) {
    const w1 = parseInt(hexGroups[hexGroups.length - 2] || '0', 16) || 0;
    const w2 = parseInt(hexGroups[hexGroups.length - 1] || '0', 16) || 0;
    const a = ((w1 >> 8) & 0xff) || 100;
    const b = w1 & 0xff;
    const c = (w2 >> 8) & 0xff;
    const d = (w2 & 0xff) || 1;
    return `${a}.${b}.${c}.${d}`;
  }
  return '127.0.0.1';
}

export function getRawConnectingIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip')?.trim() ??
    headers.get('x-real-ip')?.trim() ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  );
}

export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    lastSweep = now;
  }

  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;

  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export function getClientAddress(headers: Headers): string {
  const rawConnecting = getRawConnectingIp(headers);

  // 1. Check cookie set by ClientIpSync (real public IPv4 of dual-stack browser)
  const cookieHeader = headers.get('cookie') ?? '';
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)kctf_ipv4=([^;]+)/);
  if (cookieMatch) {
    const cookieIp = decodeURIComponent(cookieMatch[1]).trim();
    if (isValidIpv4(cookieIp)) {
      registerClientIpv4(rawConnecting, cookieIp);
      return cookieIp;
    }
  }

  // 2. Check headers for native IPv4
  const candidateHeaders = [
    headers.get('cf-pseudo-ipv4'),
    headers.get('cf-connecting-ip'),
    headers.get('x-real-ip'),
    headers.get('x-forwarded-for'),
  ];
  for (const cand of candidateHeaders) {
    if (!cand) continue;
    const match = cand.match(IPV4_EXTRACT_RE);
    if (match && isValidIpv4(match[1])) {
      return match[1];
    }
  }

  // 3. Resolve mapped IPv4 or fallback IPv4
  return ipv6ToFallbackIpv4(rawConnecting);
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
