import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, target = '/ctf') {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(target)}`);
  await page.getByLabel('이메일').fill('e2e@example.test');
  await page.getByLabel('비밀번호').fill('e2e-password-123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  // The dev server compiles the destination on its first authenticated request.
  await expect(page).toHaveURL(new RegExp(target.replaceAll('?', '\\?')), { timeout: 20_000 });
}

test('filters and dialogs survive history navigation and refresh', async ({ page }) => {
  await signIn(page);
  const filters = page.getByRole('group', { name: '카테고리 필터' });
  await filters.getByRole('button', { name: 'PWN', exact: true }).click();
  await expect(page).toHaveURL(/category=pwn$/);
  await expect(page.locator('.challenge-groups')).not.toHaveAttribute('aria-live');
  await expect(page.getByRole('status')).toHaveText('PWN 문제 1개 표시');
  await page.reload();
  await expect(filters.getByRole('button', { name: 'PWN', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Socket Relay,/ }).click();
  await expect(page).toHaveURL(/challenge=e2e-tcp/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/category=pwn$/);
  await page.goForward();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/category=pwn$/);
  await filters.getByRole('button', { name: 'WEB', exact: true }).click();
  await page.goBack();
  await expect(filters.getByRole('button', { name: 'PWN', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('a direct link closes safely and keyboard focus stays in the dialog', async ({ page }) => {
  await signIn(page, '/ctf?challenge=e2e-markdown');
  const dialog = page.getByRole('dialog');
  const close = dialog.getByRole('button', { name: '닫기', exact: true });
  await expect(close).toBeFocused();
  await expect(dialog).toHaveCSS('min-height', '540px');
  await close.press('Shift+Tab');
  await expect(dialog.getByLabel('플래그 제출')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/ctf$/);
  await expect(page.getByRole('button', { name: 'ALL', exact: true })).toBeFocused();
});

test('TCP copy preserves the full command and reports clipboard failure', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page, '/ctf?challenge=e2e-tcp');
  const copy = page.getByRole('button', { name: '명령어 복사' });
  await copy.click();
  await expect(page.locator('.copy-command-status')).toHaveText('복사했습니다');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('nc relay.example.com 31337');
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { value: async () => { throw new Error('denied'); }, configurable: true });
  });
  await copy.click();
  await expect(page.locator('.copy-command-status')).toContainText('직접 복사');
  await expect(page.locator('.copy-command code')).toHaveText('nc relay.example.com 31337');
});

test('long descriptions scroll while mobile and light mode controls stay visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await signIn(page, '/ctf?challenge=e2e-tcp');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const metrics = await page.locator('.dialog-body').evaluate((body) => ({
    overflow: body.scrollHeight > body.clientHeight,
    scrollbar: getComputedStyle(body).scrollbarWidth,
    scrollbarDisplay: getComputedStyle(body, '::-webkit-scrollbar').display,
  }));
  expect(metrics.overflow).toBe(true);
  expect(metrics.scrollbar).toBe('thin');
  expect(metrics.scrollbarDisplay).toBe('block');
  await expect(page.locator('.dialog-scroll-hint')).toBeVisible();
  await page.locator('.dialog-body').evaluate((body) => { body.scrollTop = body.scrollHeight; });
  await expect(page.locator('.dialog-scroll-hint')).toHaveCount(0);
  const contrast = await page.locator('.flag-form label').evaluate((label) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const foreground = luminance(getComputedStyle(label).color);
    const background = luminance(getComputedStyle(label.closest('.dialog-dock')!).backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  const bounds = await dialog.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(500);
  expect(bounds!.width).toBeLessThanOrEqual(370);
  await expect(page.getByLabel('플래그 제출')).toBeInViewport();
  await expect(page.getByRole('button', { name: '명령어 복사' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 667, height: 375 });
  await page.getByLabel('플래그 제출').scrollIntoViewIfNeeded();
  await expect(page.getByLabel('플래그 제출')).toBeInViewport();
});

test('card focus restores after closing and rapid modal interruptions settle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  const card = page.getByRole('button', { name: /^Markdown Signal,/ });
  await card.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card).toBeFocused();
  await card.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/challenge-opening|challenge-closing/);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  expect(errors).toEqual([]);
});

test('a delayed solve updates progress without changing another open challenge', async ({ page }) => {
  let releaseResponse: () => void = () => {};
  const responseReady = new Promise<void>((resolve) => { releaseResponse = resolve; });
  await page.route('**/api/challenges/e2e-markdown/submit', async (route) => {
    await responseReady;
    await route.fulfill({ json: { correct: true, alreadySolved: false, solves: 3, points: 100 } });
  });
  await signIn(page);
  await page.getByRole('button', { name: /^Markdown Signal,/ }).click();
  await page.getByLabel('플래그 제출').fill('KCTF{test_response}');
  await page.getByRole('button', { name: '제출', exact: true }).click();
  await expect(page.getByRole('button', { name: '확인 중…' })).toBeDisabled();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^Socket Relay,/ }).click();
  releaseResponse();
  await expect(page.locator('.challenge-progress')).toHaveText('전체 1 / 2 해결');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Socket Relay', exact: true })).toBeVisible();
  await expect(page.locator('.flag-status-badge')).toBeEmpty();
});
