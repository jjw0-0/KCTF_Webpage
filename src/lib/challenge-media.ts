export function safeResourceUrl(value: string): string | undefined {
  const url = value.trim();
  if (!url || /[\u0000-\u0020\\]/.test(url)) return undefined;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

export function getVideoSource(value: string): { kind: 'video' | 'embed'; src: string } | undefined {
  const safe = safeResourceUrl(value);
  if (!safe) return undefined;
  const url = new URL(safe, 'https://ctf.jjw0-0.kr');
  if (/\.(mp4|webm|ogv|m4v)$/i.test(url.pathname)) return { kind: 'video', src: safe };
  let id: string | null = null;
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)\/?$/)?.[1] ?? null;
  } else if (url.hostname === 'youtu.be') {
    id = url.pathname.slice(1);
  }
  if (id && /^[\w-]{11}$/.test(id)) return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${id}` };
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
    const vimeoId = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/)?.[1];
    if (vimeoId) return { kind: 'embed', src: `https://player.vimeo.com/video/${vimeoId}` };
  }
  return undefined;
}
