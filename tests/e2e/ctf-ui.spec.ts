import { expect, test, type Page } from '@playwright/test';

let clientCounter = 40;

test('public profiles resolve readable usernames and exclude administrators', async ({ page }) => {
  const response = await page.goto('/users/e2e_player');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'e2e_player', exact: true })).toBeVisible();
  const admin = await page.goto('/users/e2e_admin');
  expect(admin?.status()).toBe(404);
});

async function signIn(page: Page, target = '/challenges') {
  clientCounter += 1;
  await page.setExtraHTTPHeaders({ 'x-real-ip': `198.51.100.${clientCounter}` });
  await page.goto(`/login?callbackUrl=${encodeURIComponent(target)}`);
  await page.getByLabel('이메일').fill('e2e@example.test');
  await page.getByLabel('비밀번호').fill('e2e-password-123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(target.replaceAll('?', '\\?')), { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

test('category filters and the challenge dialog keep the original interaction', async ({ page }) => {
  await signIn(page);
  const filters = page.getByRole('group', { name: '카테고리 필터' });
  const pwnFilter = filters.getByRole('button', { name: 'PWN', exact: true });
  await pwnFilter.click();
  await expect(pwnFilter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^Socket Relay,/ })).toBeVisible();
  await page.getByRole('button', { name: /^Socket Relay,/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('nc relay.example.com 31337')).toBeVisible();
});

test('a direct challenge link opens and closes without changing its labels', async ({ page }) => {
  await signIn(page, '/challenges?challenge=e2e-markdown');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Markdown Signal' })).toBeVisible();
  await expect(dialog.getByText('Author')).toBeVisible();
  await expect(dialog.getByText('PTS')).toBeVisible();
});

test('the dialog stays single-column even with a legacy layout parameter', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await signIn(page, '/challenges?challenge=e2e-markdown');
  const descriptionDialog = await page.getByRole('dialog').boundingBox();
  await expect(page.locator('.dialog-workspace')).toHaveCSS('flex-direction', 'column');
  await expect(page.locator('.dialog-workspace')).toHaveCSS('overflow', 'hidden');
  await expect(page.locator('.dialog-body')).toHaveCSS('overflow-y', 'auto');

  await page.goto('/challenges?challenge=e2e-instance&modalLayout=console');
  await expect(page.locator('.dialog-workspace')).toHaveCSS('flex-direction', 'column');
  await expect(page.getByRole('dialog')).not.toHaveClass(/is-console-layout/);
  const instanceDialog = await page.getByRole('dialog').boundingBox();
  expect(instanceDialog?.width).toBe(descriptionDialog?.width);
  expect(instanceDialog?.height).toBe(descriptionDialog?.height);
});

test('challenge cards use one cyberpunk surface and short dialogs keep every action reachable', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await signIn(page);
  const card = page.getByRole('button', { name: /^Socket Relay,/ });
  await expect(card.locator('.stacked-card-surface')).toHaveCount(1);
  await expect(card.locator('.stacked-card-depth')).toHaveCount(0);
  await expect(card.locator('.card-circuit')).toHaveCount(1);
  await card.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeInViewport();
  const flag = dialog.getByLabel('플래그 제출');
  await flag.scrollIntoViewIfNeeded();
  await expect(flag).toBeInViewport();
});

test('long descriptions show a scroll continuation hint until the end', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, '/challenges?challenge=e2e-tcp');
  const body = page.locator('.dialog-body');
  await expect(page.locator('.dialog-scroll-hint')).toBeVisible();
  await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator('.dialog-scroll-hint')).toHaveCount(0);
  await expect(page.getByLabel('플래그 제출')).toBeInViewport();
});

test('HTTP Instance exposes a clean address without a session form', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page, '/challenges?challenge=e2e-instance');
  const instance = page.getByRole('region', { name: 'Challenge Instance' });
  await expect(instance.getByText('http://instance.example.test:10022')).toBeVisible();
  const open = instance.getByRole('link', { name: '열기' });
  await expect(open).toHaveAttribute('href', 'http://instance.example.test:10022');
  await expect(instance.locator('form')).toHaveCount(0);
  await instance.getByRole('button', { name: 'Instance 주소 복사' }).click();
  await expect(instance.getByText('클립보드에 복사했습니다.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://instance.example.test:10022');
  expect((await context.cookies()).find((cookie) => cookie.name === 'kctf_instance_token')?.value).toBe('e2e-browser-token');
});
