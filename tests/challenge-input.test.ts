import assert from 'node:assert/strict';
import test from 'node:test';
import { challengeInputSchema } from '../src/lib/challenge-input.ts';

const validChallenge = {
  title: 'Header Maze',
  summary: '프록시 헤더 신뢰 경계를 찾으세요.',
  description: '관리자용 문제 설명',
  categoryId: 'cat-web',
  points: 300,
  difficulty: 'INTERMEDIATE' as const,
  tags: ['HTTP'],
  flag: 'KCTF{test}',
  instanceSlug: 'header_maze',
  visible: true,
};

test('challenge input accepts a complete challenge', () => {
  assert.equal(challengeInputSchema.safeParse(validChallenge).success, true);
});

test('challenge input rejects unsafe instance slugs and invalid points', () => {
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, instanceSlug: '../escape' }).success, false);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, points: 0 }).success, false);
});
