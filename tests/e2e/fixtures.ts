import { expect, test as base, type Page } from '@playwright/test';

type BrowserAudit = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
};

async function assertNoDisplayedNonFiniteValues(page: Page) {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  expect(bodyText).not.toMatch(/\b(?:NaN|-?Infinity)\b/);
}

export const test = base.extend<{ browserAudit: BrowserAudit }>({
  browserAudit: async ({ page }, use) => {
    const audit: BrowserAudit = {
      consoleErrors: [],
      pageErrors: [],
      requestFailures: [],
    };

    page.on('console', (message) => {
      if (message.type() === 'error') {
        audit.consoleErrors.push(message.text());
      }
    });

    page.on('pageerror', (error) => {
      audit.pageErrors.push(error.message);
    });

    page.on('requestfailed', (request) => {
      const resourceType = request.resourceType();
      if (resourceType === 'document' || resourceType === 'script' || request.url().includes('worker')) {
        audit.requestFailures.push(`${resourceType}: ${request.url()} (${request.failure()?.errorText ?? 'unknown failure'})`);
      }
    });

    await use(audit);

    await assertNoDisplayedNonFiniteValues(page);
    expect(audit.consoleErrors, `Browser console errors:\n${audit.consoleErrors.join('\n')}`).toEqual([]);
    expect(audit.pageErrors, `Uncaught browser exceptions:\n${audit.pageErrors.join('\n')}`).toEqual([]);
    expect(audit.requestFailures, `Failed critical browser requests:\n${audit.requestFailures.join('\n')}`).toEqual([]);
  },
});

export { expect };

export async function waitForDesignReady(page: Page) {
  await expect(page.getByText('Exact product verified')).toBeVisible();
  await expect(page.getByText('Experimental-use warning:', { exact: false })).toBeVisible();
}
