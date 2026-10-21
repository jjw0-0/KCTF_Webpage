import test from 'node:test';
import assert from 'node:assert/strict';
import { digestFlag, matchesFlag } from '../src/lib/flags.ts';

test('flag matching trims input and rejects different values', () => {
  const digest = digestFlag('KCTF{correct}', 'test-secret');
  assert.equal(matchesFlag(' KCTF{correct}\n', digest, 'test-secret'), true);
  assert.equal(matchesFlag('KCTF{wrong}', digest, 'test-secret'), false);
});
