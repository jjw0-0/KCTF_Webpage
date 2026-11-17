import { expect, test } from '@playwright/test';

test('registration validates input and protects existing accounts', async ({ request }) => {
  const invalid = await request.post('/api/register', {
    data: { username: '../bad', email: 'bad', password: 'short' },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toHaveProperty('error');

  const duplicate = await request.post('/api/register', {
    data: { username: 'new_player', email: 'E2E@EXAMPLE.TEST', password: 'another-password-123' },
  });
  expect(duplicate.status()).toBe(409);
  expect(await duplicate.json()).toHaveProperty('error');
});

test('anonymous users cannot reach the challenge board or submit flags', async ({ page, request }) => {
  const submission = await request.post('/api/challenges/e2e-markdown/submit', {
    data: { flag: 'KCTF{e2e_signal}' },
  });
  expect(submission.status()).toBe(401);
  await page.goto('/ctf?challenge=e2e-markdown');
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await expect(page.getByLabel('이메일')).toBeVisible();
});

test('a registered user can sign in and open a challenge deep link', async ({ page }) => {
  await page.goto('/login?callbackUrl=%2Fctf%3Fchallenge%3De2e-markdown');
  await page.getByLabel('이메일').fill('e2e@example.test');
  await page.getByLabel('비밀번호').fill('e2e-password-123');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/ctf\?challenge=e2e-markdown/);
  await expect(page.getByText('Markdown Signal').first()).toBeVisible();
});

test('wrong credentials fail without granting access', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('이메일').fill('e2e@example.test');
  await page.getByLabel('비밀번호').fill('wrong-password-123');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.goto('/ctf');
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
});

test('authenticated flag flow validates input, scores once, and denies admin writes', async ({ page, request }) => {
  const unique = Date.now().toString(36);
  const email = `api-${unique}@example.test`;
  const registration = await request.post('/api/register', {
    data: { username: `api_${unique}`, email, password: 'api-password-123' },
  });
  expect(registration.status()).toBe(201);

  await page.goto('/login');
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호').fill('api-password-123');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/ctf/);

  const api = page.context().request;
  const adminWrite = await api.post('/api/admin/challenges', { data: {} });
  expect(adminWrite.status()).toBe(404);
  expect(await adminWrite.json()).toMatchObject({ error: '페이지를 찾을 수 없습니다.' });

  const url = '/api/challenges/e2e-markdown/submit';
  const invalid = await api.post(url, { data: { flag: '' } });
  expect(invalid.status()).toBe(400);
  const wrong = await api.post(url, { data: { flag: 'KCTF{wrong}' } });
  expect(wrong.status()).toBe(200);
  expect(await wrong.json()).toMatchObject({ correct: false });
  const correct = await api.post(url, { data: { flag: ' KCTF{e2e_signal} ' } });
  expect(correct.status()).toBe(200);
  expect(await correct.json()).toMatchObject({ correct: true, alreadySolved: false, points: 100 });
  const duplicate = await api.post(url, { data: { flag: 'KCTF{e2e_signal}' } });
  expect(duplicate.status()).toBe(200);
  expect(await duplicate.json()).toMatchObject({ correct: true, alreadySolved: true });
});
