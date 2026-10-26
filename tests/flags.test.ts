import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPlainFlag } from '../src/lib/flags.ts';

test('flag matching trims input and rejects different values', () => {
  assert.equal(matchesPlainFlag(' KCTF{correct}\n', 'KCTF{correct}'), true);
  assert.equal(matchesPlainFlag('KCTF{wrong}', 'KCTF{correct}'), false);
});
