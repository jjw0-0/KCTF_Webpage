import test from 'node:test';
import assert from 'node:assert/strict';
import { sendSolveNotice } from '../src/lib/discord.ts';

test('Discord announces solves and First Blood', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.DISCORD_SOLVE_WEBHOOK_URL;
  const titles: string[] = [];
  process.env.DISCORD_SOLVE_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    titles.push(body.embeds[0].title);
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  try {
    await sendSolveNotice({ challenge: 'Web', solver: 'team', points: 100, firstBlood: true });
    await sendSolveNotice({ challenge: 'Web', solver: 'user', points: 100, firstBlood: false });
    assert.deepEqual(titles, ['🩸 First Blood', '✅ Solve']);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.DISCORD_SOLVE_WEBHOOK_URL;
    else process.env.DISCORD_SOLVE_WEBHOOK_URL = originalUrl;
  }
});
