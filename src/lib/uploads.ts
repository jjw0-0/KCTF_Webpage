export const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
export const MAX_CHALLENGE_FILE_BYTES = 10 * 1024 * 1024;

const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isValidAvatar(bytes: Uint8Array, type: string) {
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES || !AVATAR_TYPES.has(type)) return false;
  if (type === 'image/png') return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

export function decodeAvatarDataUrl(value: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Uint8Array.from(Buffer.from(match[2], 'base64'));
  return isValidAvatar(bytes, match[1]) ? { contentType: match[1], bytes } : null;
}

export function safeDownloadName(name: string) {
  const cleaned = name.replace(/[\r\n\\/\0]/g, '_').trim();
  return cleaned.slice(0, 180) || 'challenge-file';
}

export async function readBoundedFormData(
  request: Request,
  maxFileBytes: number,
): Promise<{ status: 'ok'; formData: FormData } | { status: 'too_large' } | { status: 'invalid' }> {
  const maxTotalBytes = maxFileBytes + 128 * 1024;
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > maxTotalBytes) {
    return { status: 'too_large' };
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return { status: 'invalid' };
  }

  if (!request.body) {
    return { status: 'invalid' };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxTotalBytes) {
          await reader.cancel().catch(() => undefined);
          return { status: 'too_large' };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { status: 'invalid' };
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const syntheticRequest = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: combined,
    });
    const formData = await syntheticRequest.formData();
    return { status: 'ok', formData };
  } catch {
    return { status: 'invalid' };
  }
}
