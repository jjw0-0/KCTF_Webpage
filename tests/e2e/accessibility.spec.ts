import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, clientIp: string) {
  await page.setExtraHTTPHeaders({ 'x-real-ip': clientIp });
  await page.goto('/login?callbackUrl=%2Fctf');
  await page.getByLabel('이메일').fill('e2e@example.test');
  await page.getByLabel('비밀번호').fill('e2e-password-123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/ctf$/, { timeout: 20_000 });
}

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
  await page.getByRole('button', { name: '화면 모드 전환' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', initialTheme === 'light' ? 'dark' : 'light');
  const toggledColor = await page.locator('.site-header').evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(toggledColor).not.toBe(initialColor);
});
