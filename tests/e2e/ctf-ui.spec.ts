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

test('challenge cards use one cyberpunk surface and short dialogs keep every fixed action reachable', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await signIn(page);
  const card = page.getByRole('button', { name: /^Socket Relay,/ });
  await expect(card.locator('.stacked-card-surface')).toHaveCount(1);
  await expect(card.locator('.stacked-card-depth')).toHaveCount(0);
  await expect(card.locator('.card-circuit')).toHaveCount(1);
  await page.goto('/challenges?challenge=e2e-instance');

  const dialog = page.getByRole('dialog', { name: 'HTTP Workshop' });
  await expect(dialog).toBeInViewport();
  await expect(dialog.getByRole('link', { name: /workshop\.zip/ })).toBeInViewport();
  await expect(dialog.getByRole('region', { name: 'Challenge Instance' })).toBeInViewport();
  const flag = dialog.getByLabel('플래그 제출');
  await expect(flag).toBeInViewport();
  const [dialogBox, dockBox] = await Promise.all([
    dialog.boundingBox(),
    page.locator('.dialog-dock').boundingBox(),
  ]);
  expect(dialogBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height);
});

test('short landscape dialogs contain long submission errors without moving fixed actions', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.route('**/api/challenges/e2e-instance/submit', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: '플래그를 제출하지 못했습니다. 네트워크 연결을 확인한 뒤 잠시 후 다시 시도해 주세요. 문제가 계속되면 운영진에게 문의해 주세요.' }),
    });
  });
  await signIn(page, '/challenges?challenge=e2e-instance');
  const dialog = page.getByRole('dialog', { name: 'HTTP Workshop' });
  await dialog.getByLabel('플래그 제출').fill('KCTF{retry}');
  await dialog.getByRole('button', { name: '제출', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('플래그를 제출하지 못했습니다.');
  await expect(dialog.getByLabel('플래그 제출')).toBeInViewport();
  await expect(dialog.getByRole('button', { name: '제출', exact: true })).toBeInViewport();
  await expect(dialog.getByRole('link', { name: /workshop\.zip/ })).toBeInViewport();
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

test('Instance replacement and termination require explicit confirmation', async ({ page }) => {
  let postCount = 0;
  let deleteCount = 0;
  const previousInstance = {
    challengeId: 'another-challenge',
    url: 'http://previous.example.test:10022',
    accessToken: 'previous-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const nextInstance = { ...previousInstance, challengeId: 'e2e-instance', url: 'http://next.example.test:10022' };

  await page.route('**/api/instances', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      postCount += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ instance: nextInstance }) });
      return;
    }
    if (method === 'DELETE') {
      deleteCount += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ instance: previousInstance }) });
  });

  await signIn(page, '/challenges?challenge=e2e-instance');
  const instance = page.getByRole('region', { name: 'Challenge Instance' });
  const replace = instance.getByRole('button', { name: '이 문제로 교체' });
  await replace.click();
  let confirmation = page.getByRole('dialog', { name: 'Instance 교체' });
  await expect(confirmation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'HTTP Workshop' })).toBeVisible();
  await expect(replace).toBeFocused();

  await replace.click();
  confirmation = page.getByRole('dialog', { name: 'Instance 교체' });
  await confirmation.getByRole('button', { name: '취소' }).click();
  await expect(replace).toBeFocused();
  expect(postCount).toBe(0);

  await replace.click();
  confirmation = page.getByRole('dialog', { name: 'Instance 교체' });
  await confirmation.getByRole('button', { name: 'Instance 교체' }).click();
  await expect(instance.getByRole('button', { name: 'Instance 종료' })).toBeVisible();
  expect(postCount).toBe(1);

  const stop = instance.getByRole('button', { name: 'Instance 종료' });
  await stop.click();
  confirmation = page.getByRole('dialog', { name: 'Instance 종료' });
  await confirmation.getByRole('button', { name: '취소' }).click();
  await expect(stop).toBeFocused();
  expect(deleteCount).toBe(0);

  await stop.click();
  confirmation = page.getByRole('dialog', { name: 'Instance 종료' });
  await confirmation.getByRole('button', { name: 'Instance 종료' }).click();
  await expect(instance.getByRole('button', { name: 'Instance 생성' })).toBeVisible();
  expect(deleteCount).toBe(1);
});
