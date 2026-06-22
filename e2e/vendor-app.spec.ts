import { expect, type Page, test } from '@playwright/test';

const vendorUsername = process.env['VENDOR_E2E_USERNAME'] || 'seed_vendor_flash_fresh_indiranagar';
const vendorPassword = process.env['VENDOR_E2E_PASSWORD'] || 'CodexVendor123!';

async function waitForShell(page: Page): Promise<void> {
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('app-global-loading')).toBeHidden({ timeout: 20_000 });
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await waitForShell(page);
  await page.getByLabel(/username/i).fill(vendorUsername);
  await page.getByLabel(/password/i).fill(vendorPassword);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /vendor dashboard/i })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.bodyOverflow).toBeLessThanOrEqual(1);
}

test('guest routes show login and registration surfaces', async ({ page }) => {
  await page.goto('/');
  await waitForShell(page);
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

  await page.getByRole('link', { name: /register your store/i }).click();
  await expect(page.getByRole('heading', { name: /partner with us/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
});

test('invalid login reports an error without entering the app shell', async ({ page }) => {
  await page.goto('/login');
  await waitForShell(page);
  await page.getByLabel(/username/i).fill(vendorUsername);
  await page.getByLabel(/password/i).fill('wrong-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/invalid credentials|no active account/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /vendor dashboard/i })).toBeHidden();
});

test('approved vendor can login and open core workspace pages', async ({ page }) => {
  await login(page);

  const pageChecks: Array<[string, RegExp]> = [
    ['/products', /^products$/i],
    ['/inventory', /^inventory$/i],
    ['/orders', /^orders$/i],
    ['/analytics', /sales report/i],
    ['/payouts', /payments & settlements/i],
    ['/promotions', /promotions|coupons/i],
    ['/support', /support/i],
    ['/reviews', /reviews/i],
    ['/notifications', /notifications/i],
    ['/store-settings', /store settings|store profile/i],
  ];

  for (const [path, heading] of pageChecks) {
    await page.goto(path);
    await waitForShell(page);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    await expect(page.getByText(/feature unavailable/i)).toBeHidden();
  }
});

test('product search and order filter controls remain usable', async ({ page }) => {
  await login(page);

  await page.goto('/products');
  await waitForShell(page);
  await page.getByLabel(/search products/i).fill('milk');
  await expect(page.getByLabel(/search products/i)).toHaveValue('milk');

  await page.goto('/orders');
  await waitForShell(page);
  await page.getByLabel(/order status filter/i).selectOption('placed');
  await expect(page.getByLabel(/order status filter/i)).toHaveValue('placed');
});

test('mobile vendor shell has navigation and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  await expect(page.getByRole('button', { name: /open navigation/i })).toBeVisible();
  await expect(page.getByRole('navigation', { name: /primary mobile navigation/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto('/orders');
  await waitForShell(page);
  await expect(page.getByRole('heading', { name: /^orders$/i }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
