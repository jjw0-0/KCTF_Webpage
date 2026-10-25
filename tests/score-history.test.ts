import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ScoreHistoryChart from '../src/components/ScoreHistoryChart.tsx';

test('score history renders one cumulative track per ranked player', () => {
  const leaderboard = [
    { rank: 1, userId: 'u1', name: 'alpha', score: 300, solved: 2 },
    { rank: 2, userId: 'u2', name: 'beta', score: 100, solved: 1 },
  ];
  const history = [
    { userId: 'u1', name: 'alpha', points: 100, solvedAt: new Date('2026-12-10T01:00:00Z') },
    { userId: 'u2', name: 'beta', points: 100, solvedAt: new Date('2026-12-10T02:00:00Z') },
    { userId: 'u1', name: 'alpha', points: 200, solvedAt: new Date('2026-12-10T03:00:00Z') },
  ];
  const markup = renderToStaticMarkup(createElement(ScoreHistoryChart, { leaderboard, history }));
  assert.match(markup, /상위 참가자 누적 점수 변화/);
  assert.equal((markup.match(/score-player-line/g) ?? []).length, 2);
  assert.match(markup, /alpha 300점/);
});
