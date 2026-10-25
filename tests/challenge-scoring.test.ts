import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateChallengePoints } from '../src/lib/challenge-scoring.ts';

const base = { points: 500, minimumPoints: 100, decaySolves: 5, decrementPerSolve: 50 } as const;

test('static scoring never changes', () => {
  assert.equal(calculateChallengePoints({ ...base, scoringMode: 'STATIC' }, 40), 500);
});

test('linear scoring drops by a fixed amount after each additional solve', () => {
  const challenge = { ...base, scoringMode: 'LINEAR' } as const;
  assert.equal(calculateChallengePoints(challenge, 1), 500);
  assert.equal(calculateChallengePoints(challenge, 3), 400);
  assert.equal(calculateChallengePoints(challenge, 20), 100);
});

test('dynamic scoring curves down to its configured floor', () => {
  const challenge = { ...base, scoringMode: 'DYNAMIC' } as const;
  assert.equal(calculateChallengePoints(challenge, 1), 500);
  assert.equal(calculateChallengePoints(challenge, 3), 400);
  assert.equal(calculateChallengePoints(challenge, 5), 100);
  assert.equal(calculateChallengePoints(challenge, 20), 100);
});
