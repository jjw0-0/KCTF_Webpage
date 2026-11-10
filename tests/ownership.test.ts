import test from 'node:test';
import assert from 'node:assert/strict';
import { dynamicFlag, issueToken } from '../src/lib/ownership.ts';

test('personal and team tokens have distinct prefixes and hashes', () => {
  const personal = issueToken('personal');
  const team = issueToken('team');
  assert.match(personal.token, /^kctf_p_/);
  assert.match(team.token, /^kctf_t_/);
  assert.notEqual(personal.hash, team.hash);
  assert.equal(personal.token.includes(personal.hash), false);
});

test('dynamic flags are stable per owner and challenge', () => {
  process.env.DYNAMIC_FLAG_SECRET = 'test-secret';
  const owner = { key: 'team:one', userId: 'u1', teamId: 'one', label: 'one', tokenHash: 'hash', tokenPrefix: 'kctf_t_test' };
  const rotated = { ...owner, tokenHash: 'new-hash' };
  assert.equal(dynamicFlag('web-1', owner), dynamicFlag('web-1', owner));
  assert.notEqual(dynamicFlag('web-1', owner), dynamicFlag('web-2', owner));
  assert.notEqual(dynamicFlag('web-1', owner), dynamicFlag('web-1', rotated));
});
