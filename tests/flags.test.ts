import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveInstanceFlag, digestFlag, matchesFlag, matchesInstanceFlag } from '../src/lib/flags.ts';

test('flag matching trims input and rejects different values', () => {
  const digest = digestFlag('KCTF{correct}', 'test-secret');
  assert.equal(matchesFlag(' KCTF{correct}\n', digest, 'test-secret'), true);
  assert.equal(matchesFlag('KCTF{wrong}', digest, 'test-secret'), false);
});

test('instance flags are stable per challenge and user', () => {
  const first = deriveInstanceFlag('challenge-1', 42, 'instance-secret');
  assert.match(first, /^KCTF\{[A-Za-z0-9_-]{32}\}$/);
  assert.equal(first, deriveInstanceFlag('challenge-1', 42, 'instance-secret'));
  assert.notEqual(first, deriveInstanceFlag('challenge-1', 43, 'instance-secret'));
  assert.equal(matchesInstanceFlag(` ${first}\n`, 'challenge-1', 42, 'instance-secret'), true);
  assert.equal(matchesInstanceFlag(first, 'challenge-1', 43, 'instance-secret'), false);
});
