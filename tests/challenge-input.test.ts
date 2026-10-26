import assert from 'node:assert/strict';
import test from 'node:test';
import { challengeInputSchema, deriveChallengeSummary } from '../src/lib/challenge-input.ts';

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

test('challenge authors and attachments round-trip with optional fields', () => {
  const result = challengeInputSchema.parse({ ...validChallenge, author: '  K.knock  ', fileUrl: 'https://example.com/challenge.zip' });
  assert.equal(result.author, 'K.knock');
  assert.equal(result.fileUrl, 'https://example.com/challenge.zip');
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, fileUrl: '' }).success, true);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, fileUrl: '/files/challenge.zip' }).success, true);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, fileUrl: 'javascript:alert(1)' }).success, false);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, author: 'x'.repeat(81) }).success, false);
});

test('admin-only fields receive safe defaults and summary is derived from description', () => {
  const parsed = challengeInputSchema.parse({ title: 'Minimal challenge', description: '# Find the `flag`', categoryId: 'web', points: 100, flag: 'KCTF{x}' });
  assert.equal(parsed.visible, true);
  assert.equal(parsed.difficulty, 'INTERMEDIATE');
  assert.equal(parsed.scoringMode, 'STATIC');
  assert.deepEqual(parsed.tags, []);
  assert.equal(deriveChallengeSummary(parsed.description), 'Find the flag');
});

test('dynamic scoring configuration keeps its floor below the initial score', () => {
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, scoringMode: 'DYNAMIC', minimumPoints: 100, decaySolves: 20 }).success, true);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, scoringMode: 'LINEAR', minimumPoints: 100, decrementPerSolve: 25 }).success, true);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, scoringMode: 'DYNAMIC', minimumPoints: 300 }).success, false);
});

test('Instance and direct address access modes are mutually exclusive', () => {
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, usesVm: true, instancePort: 8080, connectionUrl: '' }).success, true);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, usesVm: true, usesCompose: true, instancePort: 8080, connectionUrl: '' }).success, true);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, usesVm: true, connectionUrl: '' }).success, false);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, usesVm: false, usesCompose: true, connectionUrl: '' }).success, false);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, usesVm: false, connectionUrl: 'https://challenge.example.com' }).success, true);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, usesVm: false, connectionType: 'TCP', connectionUrl: 'challenge.example.com:31337' }).success, true);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, usesVm: false, connectionType: 'TCP', connectionUrl: 'https://challenge.example.com' }).success, false);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, usesVm: false, connectionUrl: '' }).success, true);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, usesVm: true, instancePort: 8080, connectionUrl: 'https://challenge.example.com' }).success, false);
  assert.equal(challengeInputSchema.safeParse({ ...validChallenge, connectionUrl: 'javascript:alert(1)' }).success, false);
});
