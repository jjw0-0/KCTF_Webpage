import test from 'node:test';
import assert from 'node:assert/strict';
import { sendSolveNotice } from '../src/lib/discord.ts';

test('Discord announces solves and First Blood', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.DISCORD_SOLVE_WEBHOOK_URL;
  const embeds: { title: string; color: number }[] = [];
  process.env.DISCORD_SOLVE_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    embeds.push({ title: body.embeds[0].title, color: body.embeds[0].color });
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  try {
    await sendSolveNotice({ challenge: 'Web', solver: 'team', points: 100, firstBlood: true });
    await sendSolveNotice({ challenge: 'Web', solver: 'user', points: 100, firstBlood: false });
    assert.deepEqual(embeds, [
      { title: '🩸 First Blood', color: 0xe74c3c },
      { title: '✅ Solve', color: 0x4de0a7 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.DISCORD_SOLVE_WEBHOOK_URL;
    else process.env.DISCORD_SOLVE_WEBHOOK_URL = originalUrl;
  }
});
