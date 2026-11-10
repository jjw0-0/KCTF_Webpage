type SolveNotice = { challenge: string; solver: string; points: number; firstBlood: boolean };

export async function sendSolveNotice(notice: SolveNotice) {
  const url = process.env.DISCORD_SOLVE_WEBHOOK_URL;
  if (!url) return;
  const title = notice.firstBlood ? '🩸 First Blood' : '✅ Solve';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title,
        color: notice.firstBlood ? 0xe74c3c : 0x4de0a7,
        fields: [
          { name: 'Challenge', value: notice.challenge, inline: true },
          { name: 'Solver', value: notice.solver, inline: true },
          { name: 'Points', value: String(notice.points), inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Discord webhook returned ${response.status}`);
}
