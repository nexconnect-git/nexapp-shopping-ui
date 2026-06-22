import { expect, type Page, test } from '@playwright/test';

async function waitForShell(page: Page): Promise<void> {
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('fd-app-loader')).toBeHidden({ timeout: 20_000 });
}

async function openExplore(page: Page, path = '/explore'): Promise<void> {
  await page.goto(path);
  await waitForShell(page);
  if ((page.viewportSize()?.width ?? 1440) > 760) {
    await expect(
      page.getByRole('heading', { name: /explore stores and products|results for/i }),
    ).toBeVisible();
  } else {
    await expect(page.locator('.search-page')).toBeVisible();
  }
}

async function openFirstProduct(page: Page): Promise<void> {
  await openExplore(page, '/explore?q=milk');
  const firstProduct = page.locator('fd-product-card a.image-wrap:visible').first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();
  await expect(
    page.locator('main:visible h1:visible').filter({ hasNotText: /loading product/i }).first(),
  ).toBeVisible();
}

async function seedGuestCart(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.localStorage.setItem(
      'nextou.customer.guestCart.v1',
      JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        store: { id: 'e2e-store', name: 'E2E Store' },
        items: [
          {
            id: 'e2e-product',
            apiId: 'e2e-product',
            name: 'E2E Cart Item',
            unit: '1 unit',
            price: 10,
            mrp: 10,
            discount: '',
            image: '/assets/placeholders/product.svg',
            category: 'E2E',
            rating: 0,
            storeId: 'e2e-store',
            storeName: 'E2E Store',
            quantity: 1,
            subtotal: 10,
          },
        ],
      }),
    );
  });
}

test('home opens location modal and uses the public feature endpoint', async ({ page }) => {
  const badFeatureRequests: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/admin/page-features/public')) {
      badFeatureRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/');
  await waitForShell(page);

  await page.getByRole('button', { name: /choose delivery location/i }).click();
  await expect(page.getByRole('heading', { name: /choose location/i })).toBeVisible();
  expect(badFeatureRequests).toEqual([]);
});

test('search submits a query and renders matching result sections', async ({ page }) => {
  await openExplore(page);

  const searchBox = page.getByPlaceholder(/search stores, products, brands/i);
  await searchBox.fill('milk');
  await searchBox.press('Enter');

  await expect(page).toHaveURL(/\/explore\?q=milk/);
  await expect(page.getByRole('heading', { name: /results for "milk"/i })).toBeVisible();
  await expect(
    page.locator('.product-grid fd-product-card, .store-mini-grid a, .empty-results').first(),
  ).toBeVisible();
});

test('category browse shows store or product results instead of a categories-only page', async ({ page }) => {
  await page.goto('/explore?category=bakery');
  await waitForShell(page);

  await expect(page.getByRole('heading', { name: /explore stores and products/i })).toBeVisible();
  await expect(
    page.locator('.product-grid fd-product-card, .store-mini-grid a').first(),
  ).toBeVisible();
});

test('product detail respects availability and exposes the cart shortcut on mobile only', async ({ page }) => {
  await openFirstProduct(page);

  const addToCart = page.getByRole('button', { name: /add to cart/i }).first();
  await expect(addToCart).toBeVisible();
  await page.waitForTimeout(500);
  if (await addToCart.isDisabled()) {
    await expect(page.getByText(/store is currently closed|unavailable/i).first()).toBeVisible();
  } else {
    try {
      await addToCart.click({ timeout: 5_000 });
    } catch {
      await expect(page.getByText(/store is currently closed|unavailable/i).first()).toBeVisible();
    }
  }

  await seedGuestCart(page);
  await page.goto('/');
  await waitForShell(page);
  await expect(page.locator('fd-mobile-sticky-cart-bar')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('fd-mobile-sticky-cart-bar')).toBeVisible();
  await expect(page.getByRole('link', { name: /view cart/i })).toBeVisible();
});

test('mobile product detail has no horizontal overflow and keeps detail tabs in view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFirstProduct(page);

  await expect(page.locator('.details-card .mobile-chip').first()).toBeVisible();
  const overflow = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const bodyOverflow = document.documentElement.scrollWidth - viewportWidth;
    const overflowingTabs = Array.from(
      document.querySelectorAll('.details-card .mobile-chip'),
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > viewportWidth + 1;
    }).length;
    return { bodyOverflow, overflowingTabs };
  });

  expect(overflow.bodyOverflow).toBeLessThanOrEqual(1);
  expect(overflow.overflowingTabs).toBe(0);
});
