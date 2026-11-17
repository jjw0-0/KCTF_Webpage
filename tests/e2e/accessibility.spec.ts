import { expect, test, type Page } from '@playwright/test';

let clientId = 0;
test.beforeEach(async ({ context }, testInfo) => {
  // Isolate test clients without disabling the application's login rate limit.
  await context.setExtraHTTPHeaders({ 'x-real-ip': `198.18.${testInfo.workerIndex}.${++clientId}` });
});

async function signIn(page: Page, admin = false) {
  const target = admin ? '/admin' : '/ctf';
  await page.goto(`/login?callbackUrl=${encodeURIComponent(target)}`);
  await page.getByLabel('이메일').fill(admin ? 'e2e-admin@example.test' : 'e2e@example.test');
  await page.getByLabel('비밀번호').fill('e2e-password-123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForURL((url) => url.pathname === target, { timeout: 20_000, waitUntil: 'load' });
}

test('select keyboard navigation exits in both directions and dismisses on focus loss', async ({ page }) => {
  await signIn(page, true);
  await page.getByRole('button', { name: 'CTF 관리', exact: true }).click();
  const mode = page.getByRole('button', { name: '대회 방식', exact: true });
  const status = page.getByRole('button', { name: '운영 상태', exact: true });
  await mode.focus();
  await mode.press('ArrowDown');
  await expect(page.getByRole('option', { name: '개인전', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: '팀전', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(status).toBeFocused();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(mode).toHaveText('개인전');

  await status.press('Enter');
  await page.keyboard.press('Shift+Tab');
  await expect(mode).toBeFocused();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await mode.press('Enter');
  await status.focus();
  await expect(page.getByRole('listbox')).toHaveCount(0);

  await page.getByRole('button', { name: '사용자 관리', exact: true }).click();
  const role = page.getByRole('button', { name: 'e2e_player 역할', exact: true });
  await role.click();
  await expect(page.getByRole('option', { name: 'Participant', exact: true })).toBeFocused();
  await page.keyboard.press('g');
  await expect(page.getByRole('option', { name: 'Ghost', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(role).toBeFocused();
  await expect(role).toHaveText('Participant');
});

test('native checkboxes stay visible and keyboard operable in forced colors', async ({ page, browserName }) => {
  // WebKit does not expose forced-colors emulation; its native control is still exercised.
  if (browserName !== 'webkit') await page.emulateMedia({ forcedColors: 'active', colorScheme: 'light' });
  await signIn(page, true);
  await page.getByRole('button', { name: '문제 관리', exact: true }).click();
  await page.getByRole('button', { name: '문제 추가하기' }).click();
  const checkbox = page.getByRole('checkbox', { name: '팀/개인별 Dynamic flag' });
  await checkbox.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(checkbox).toBeFocused();
  await page.keyboard.press('Space');
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toHaveCSS('opacity', '1');
  expect(await checkbox.evaluate((element) => getComputedStyle(element).appearance)).not.toBe('none');
  expect(await checkbox.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Space');
  await expect(checkbox).not.toBeChecked();
});

test('enlarged text fits mobile cards and the flag submission remains reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const card = page.getByRole('button', { name: /^Markdown Signal,/ });
  const title = card.locator('strong');
  await expect(title).toHaveCSS('font-size', '46px');
  expect(await title.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await card.click();
  const flag = page.getByLabel('플래그 제출');
  await flag.scrollIntoViewIfNeeded();
  await expect(flag).toBeInViewport();
  await expect(page.getByRole('button', { name: '제출', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toBeFocused();
  await page.setViewportSize({ width: 320, height: 844 });
  const footer = card.locator('.stacked-card-footer');
  expect(await footer.evaluate((element) => Array.from(element.children).every((child) =>
    child.getBoundingClientRect().right <= element.getBoundingClientRect().right + 1,
  ))).toBe(true);
  await page.locator('footer').scrollIntoViewIfNeeded();
  expect(await page.locator('footer a').evaluateAll((links) => links.every((link) =>
    link.getBoundingClientRect().right <= window.innerWidth,
  ))).toBe(true);
});

test('overflowing admin tables remain scrollable with native scrollbar styling', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, true);
  await page.getByRole('button', { name: '카테고리 관리', exact: true }).click();
  const table = page.getByRole('table', { name: '카테고리 관리' });
  const metrics = await table.evaluate((element) => ({
    overflow: element.scrollWidth > element.clientWidth,
    scrollbar: getComputedStyle(element).scrollbarWidth,
  }));
  expect(metrics.overflow).toBe(true);
  // Headless Firefox forces computed scrollbar-width to none, even for an unstyled page.
  if (browserName !== 'firefox') expect(metrics.scrollbar).not.toBe('none');
  await table.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  expect(await table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});
