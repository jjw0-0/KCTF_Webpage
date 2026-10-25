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

export function safeDownloadName(name: string) {
  const cleaned = name.replace(/[\r\n\\/\0]/g, '_').trim();
  return cleaned.slice(0, 180) || 'challenge-file';
}
