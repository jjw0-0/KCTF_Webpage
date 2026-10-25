import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidAvatar, MAX_AVATAR_BYTES, safeDownloadName } from '../src/lib/uploads.ts';

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
