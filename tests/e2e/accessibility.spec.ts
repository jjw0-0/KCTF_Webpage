import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, clientIp: string) {
  await page.setExtraHTTPHeaders({ 'x-real-ip': clientIp });
  await page.goto('/login?callbackUrl=%2Fchallenges');
  await page.getByLabel('이메일').fill('e2e@example.test');
  await page.getByLabel('비밀번호').fill('e2e-password-123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/challenges$/, { timeout: 20_000 });
}

test('keyboard users can skip shared navigation and focus the page content', async ({ page }) => {
  await page.goto('/login');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: '본문으로 건너뛰기' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main-content')).toBeFocused();
});

test('desktop navigation and footer span the viewport in both themes', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await signIn(page, `198.51.100.${20 + testInfo.workerIndex}`);
  const frame = await page.locator('.site-header, .site-footer').evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, right: bounds.right, width: bounds.width };
  }));
  for (const bounds of frame) {
    expect(bounds.left).toBe(0);
    expect(bounds.right).toBe(1280);
    expect(bounds.width).toBe(1280);
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(dark|light)$/);
  const initialTheme = await page.locator('html').getAttribute('data-theme');
  const initialColor = await page.locator('.site-header').evaluate((element) => getComputedStyle(element).backgroundColor);
  const initialLogoFilter = await page.locator('.brand-logo').evaluate((element) => getComputedStyle(element).filter);
  expect(initialLogoFilter === 'none').toBe(initialTheme === 'dark');
  await page.getByRole('button', { name: '화면 모드 전환' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', initialTheme === 'light' ? 'dark' : 'light');
  const toggledColor = await page.locator('.site-header').evaluate((element) => getComputedStyle(element).backgroundColor);
  const toggledLogoFilter = await page.locator('.brand-logo').evaluate((element) => getComputedStyle(element).filter);
  expect(toggledColor).not.toBe(initialColor);
  expect(toggledLogoFilter === 'none').toBe(initialTheme === 'light');
});

test('mobile navigation keeps full touch targets without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, `198.51.100.${40 + testInfo.workerIndex}`);
  const targets = page.locator('.header-primary .header-link, .theme-toggle, .auth-mobile-menu summary');
  await expect(targets).toHaveCount(4);
  const sizes = await targets.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  }));
  for (const size of sizes) {
    expect(size.height).toBeGreaterThanOrEqual(44);
    expect(size.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('anonymous mobile header and footer links keep full touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  const targets = page.locator('.header-login, .site-footer a');
  await expect(targets).toHaveCount(3);
  const sizes = await targets.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  }));
  for (const size of sizes) {
    expect(size.height).toBeGreaterThanOrEqual(44);
    expect(size.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('mobile admin navigation keeps the active section fully visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders({ 'x-real-ip': '198.51.100.92' });
  await page.goto('/login?callbackUrl=%2Fadmin');
  await page.getByLabel('이메일').fill('e2e-admin@example.test');
  await page.getByLabel('비밀번호').fill('e2e-password-123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
  const activeItem = page.getByRole('button', { name: '문제 관리', exact: true });
  await expect(activeItem).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => activeItem.evaluate((element) => {
    const item = element.getBoundingClientRect();
    const nav = element.parentElement!.getBoundingClientRect();
    return item.left >= nav.left && item.right <= nav.right;
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('admin editor controls follow the active theme after switching both ways', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-real-ip': '198.51.100.91' });
  await page.goto('/login?callbackUrl=%2Fadmin');
  await page.getByLabel('이메일').fill('e2e-admin@example.test');
  await page.getByLabel('비밀번호').fill('e2e-password-123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '문제 추가하기', exact: true }).click();
  await expect(page.locator('.challenge-admin-form')).toBeVisible();
  for (const theme of ['light', 'dark', 'light']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) {
      await page.getByRole('button', { name: '화면 모드 전환' }).click();
    }
    const field = page.locator('.challenge-admin-form input[type="number"]').first();
    await expect(field).toHaveCSS('background-color', theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(7, 12, 10)');
    await expect(field).toHaveCSS('color', theme === 'light' ? 'rgb(32, 39, 51)' : 'rgb(237, 243, 240)');
    await expect(page.locator('.scoring-mode-options label').nth(1).locator('strong')).toHaveCSS('color', theme === 'light' ? 'rgb(32, 39, 51)' : 'rgb(237, 243, 240)');
    await expect(page.locator('.challenge-admin-table button.danger').first()).toHaveCSS('color', theme === 'light' ? 'rgb(158, 52, 57)' : 'rgb(193, 123, 128)');
  }
});

test('admin management panels reflow cleanly at intermediate desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 820 });
  await page.setExtraHTTPHeaders({ 'x-real-ip': '198.51.100.93' });
  await page.goto('/login?callbackUrl=%2Fadmin');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('이메일').fill('e2e-admin@example.test');
  await page.getByLabel('비밀번호').fill('e2e-password-123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'CTF 관리', exact: true }).click();
  await expect(page.locator('.event-admin-form')).toHaveCSS('grid-template-columns', /\d+px/);
  await expect.poll(async () => page.locator('.event-time-range').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const panel = element.closest('.admin-panel')!.getBoundingClientRect();
    return bounds.left >= panel.left && bounds.right <= panel.right;
  })).toBe(true);

  await page.getByRole('button', { name: '카테고리 관리', exact: true }).click();
  await expect(page.locator('.delete-category').first()).toBeInViewport();

  await page.getByRole('button', { name: '로그', exact: true }).click();
  await expect(page.locator('.admin-server-log-head')).toBeHidden();
  const firstLog = page.locator('.admin-server-log-row').first();
  await expect(firstLog).toBeVisible();
  await expect.poll(async () => firstLog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const panel = element.closest('.admin-panel')!.getBoundingClientRect();
    return bounds.left >= panel.left && bounds.right <= panel.right;
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(900);
});

test('admin log refresh failures are visible instead of silently leaving stale data', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-real-ip': '198.51.100.94' });
  await page.goto('/login?callbackUrl=%2Fadmin');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('이메일').fill('e2e-admin@example.test');
  await page.getByLabel('비밀번호').fill('e2e-password-123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '로그', exact: true }).click();
  await page.route('**/api/admin/logs', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '로그 서버 연결 실패' }) });
  });
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.locator('.admin-log-notice')).toContainText('로그 서버 연결 실패');
});
