import type { Page } from '@playwright/test';
import { expect, openWorkbenchStep, test } from './fixtures';

const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'tablet', width: 1024, height: 768 },
  { label: 'phone', width: 390, height: 844 },
] as const;

const screenshotOptions = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  scale: 'css' as const,
  maxDiffPixelRatio: 0.005,
};

async function gotoApp(page: Page) {
  await page.goto('./');
  await expect(page.getByText('FusionPCR Studio').first()).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasOverflow).toBe(false);
}

async function loadExample(
  page: Page,
  exampleId: 'protein-fusion' | 'exact-fusion',
) {
  await page
    .getByRole('button', {
      name:
        exampleId === 'exact-fusion'
          ? 'Load exact fusion example'
          : 'Load protein fusion example',
    })
    .click();
  await expect(
    page.getByText('Sequence reconstruction verified.'),
  ).toBeVisible();
}

for (const viewport of viewports) {
  test.describe(`visual regression ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('empty state', async ({ page }) => {
      await gotoApp(page);
      await expectNoHorizontalOverflow(page);

      await expect(page.locator('.app-shell')).toHaveScreenshot(
        `empty-state-${viewport.width}x${viewport.height}.png`,
        screenshotOptions,
      );
    });

    test('exact fusion example', async ({ page }) => {
      await gotoApp(page);
      await loadExample(page, 'exact-fusion');
      await expectNoHorizontalOverflow(page);

      await expect(page.locator('.app-shell')).toHaveScreenshot(
        `exact-fusion-${viewport.width}x${viewport.height}.png`,
        screenshotOptions,
      );
    });

    test('protein fusion example', async ({ page }) => {
      await gotoApp(page);
      await loadExample(page, 'protein-fusion');
      await expectNoHorizontalOverflow(page);

      await expect(page.locator('.app-shell')).toHaveScreenshot(
        `protein-fusion-${viewport.width}x${viewport.height}.png`,
        screenshotOptions,
      );
    });

    test('selected junction', async ({ page }) => {
      await gotoApp(page);
      await loadExample(page, 'protein-fusion');
      await page
        .getByRole('button', { name: /Overlap span at the junction/i })
        .click();
      await expectNoHorizontalOverflow(page);

      await expect(page.locator('.app-shell')).toHaveScreenshot(
        `selected-junction-${viewport.width}x${viewport.height}.png`,
        screenshotOptions,
      );
    });

    test('primer results', async ({ page }) => {
      await gotoApp(page);
      await loadExample(page, 'protein-fusion');
      await openWorkbenchStep(page, 'Primers');
      await expectNoHorizontalOverflow(page);
      if (viewport.label === 'phone') {
        await expect(
          page.locator('.phone-primer-detail .primer-detail-panel'),
        ).toHaveCount(1);
      }

      await expect(page.locator('.app-shell')).toHaveScreenshot(
        `primer-results-${viewport.width}x${viewport.height}.png`,
        screenshotOptions,
      );
    });

    test('selected primer', async ({ page }) => {
      await gotoApp(page);
      await loadExample(page, 'protein-fusion');
      await openWorkbenchStep(page, 'Primers');
      await page.getByRole('button', { name: 'B_outer_R' }).click();
      await expect(
        page
          .locator('.primer-detail-panel')
          .getByRole('heading', { name: 'B_outer_R', exact: true }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await expect(page.locator('.app-shell')).toHaveScreenshot(
        `selected-primer-${viewport.width}x${viewport.height}.png`,
        screenshotOptions,
      );
    });

    test('blocking design error', async ({ page }) => {
      test.skip(
        viewport.label === 'phone',
        'Phone view is intentionally read-only and does not expose sequence editing.',
      );

      await gotoApp(page);
      await loadExample(page, 'protein-fusion');
      await openWorkbenchStep(page, 'Sequences');
      await page.getByPlaceholder('Paste fragment A DNA sequence').fill('ATGB');
      await openWorkbenchStep(page, 'Junction');
      const inspectorToggle = page.getByRole('button', {
        name: 'Show inspector',
      });
      if (await inspectorToggle.isVisible().catch(() => false)) {
        await inspectorToggle.click();
      }
      await expect(
        page.getByText(/Fragment A contains unsupported bases: B/),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await expect(page.locator('.app-shell')).toHaveScreenshot(
        `blocking-error-${viewport.width}x${viewport.height}.png`,
        screenshotOptions,
      );
    });

    test('protocol review', async ({ page }) => {
      await gotoApp(page);
      await loadExample(page, 'protein-fusion');
      await openWorkbenchStep(page, 'Protocol & Export');
      await page.getByRole('button', { name: 'Reaction setup' }).click();
      await expectNoHorizontalOverflow(page);

      await expect(page.locator('.app-shell')).toHaveScreenshot(
        `protocol-review-${viewport.width}x${viewport.height}.png`,
        screenshotOptions,
      );
    });

    test('worker failure', async ({ page }) => {
      await page.route('**/*design.worker*.js', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: 'throw new Error("forced worker failure");',
        }),
      );
      await gotoApp(page);
      await page
        .getByRole('button', { name: 'Load protein fusion example' })
        .click();
      const retryButton = page.getByRole('button', {
        name: 'Retry calculation',
      });
      if (!(await retryButton.isVisible().catch(() => false))) {
        const inspectorToggle = page.getByRole('button', {
          name: 'Show inspector',
        });
        if (await inspectorToggle.isVisible().catch(() => false)) {
          await inspectorToggle.click();
        }
      }
      await expect(
        page.getByText(
          'Design worker failed. Review the project and use Retry to calculate again.',
        ),
      ).toBeVisible();
      await expect(retryButton).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await expect(page.locator('.app-shell')).toHaveScreenshot(
        `worker-failure-${viewport.width}x${viewport.height}.png`,
        screenshotOptions,
      );
    });

    test('phone review', async ({ page }) => {
      test.skip(
        viewport.label !== 'phone',
        'Phone review coverage is specific to the phone-sized viewport.',
      );

      await gotoApp(page);
      await loadExample(page, 'exact-fusion');
      await openWorkbenchStep(page, 'Primers');
      await expect(
        page.locator('.phone-primer-detail .primer-detail-panel'),
      ).toHaveCount(1);
      await expectNoHorizontalOverflow(page);

      await expect(page.locator('.app-shell')).toHaveScreenshot(
        `phone-review-${viewport.width}x${viewport.height}.png`,
        screenshotOptions,
      );
    });
  });
}
