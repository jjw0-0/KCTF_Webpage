import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeAvatarDataUrl, isValidAvatar, isZipArchive, MAX_AVATAR_BYTES, safeDownloadName } from '../src/lib/uploads.ts';

test('avatar validation checks MIME, signature and size', () => {
  assert.equal(MAX_AVATAR_BYTES, 10 * 1024 * 1024);
  assert.equal(isValidAvatar(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), 'image/png'), true);
  assert.equal(isValidAvatar(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg'), true);
  assert.equal(isValidAvatar(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'image/jpeg'), false);
  assert.equal(isValidAvatar(new Uint8Array([1, 2, 3]), 'image/svg+xml'), false);
});

test('download names cannot inject paths or headers', () => {
  assert.equal(safeDownloadName('../payload\r\n.zip'), '.._payload__.zip');
  assert.equal(safeDownloadName(''), 'challenge-file');
});

test('challenge bundles must be ZIP files by extension and signature', () => {
  assert.equal(isZipArchive(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 'player.zip'), true);
  assert.equal(isZipArchive(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 'player.tar'), false);
  assert.equal(isZipArchive(new Uint8Array([0x7f, 0x45, 0x4c, 0x46]), 'player.zip'), false);
});

test('stored avatar data URLs decode only supported image payloads', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).toString('base64');
  assert.deepEqual(decodeAvatarDataUrl(`data:image/png;base64,${png}`), {
    contentType: 'image/png',
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]),
  });
  assert.equal(decodeAvatarDataUrl('data:image/svg+xml;base64,PHN2Zy8+'), null);
  assert.equal(decodeAvatarDataUrl('data:image/png;base64,bm90LXBuZw=='), null);
});
