import { expect, loadRunnableExample, openWorkbenchStep, test } from './fixtures';

test.describe('FusionPCR Studio multi-browser smoke', () => {
  test('loads the production build, starts the worker, and reaches a current export-ready design', async ({ page }) => {
    const workerPromise = page.waitForEvent('worker');
    await page.goto('./');

    const worker = await workerPromise;
    expect(worker.url()).toContain('design.worker');

    await loadRunnableExample(page);
    await openWorkbenchStep(page, 'Protocol & Export');

    await expect(page.getByRole('button', { name: 'Download oligo CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export project JSON' })).toBeVisible();
    await expect(page.getByText('Sequence reconstruction verified: pass')).toBeVisible();
    await expect(page.locator('header').getByText('Calculation complete')).toBeVisible();
  });
});
