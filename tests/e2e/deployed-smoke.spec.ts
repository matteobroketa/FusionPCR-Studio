import { expect, loadRunnableExample, openWorkbenchStep, test } from './fixtures';

test('public Pages deployment loads without browser/runtime faults', async ({ page }) => {
  await page.goto('./');
  await loadRunnableExample(page);
  await openWorkbenchStep(page, 'Export');

  await expect(page.getByRole('button', { name: 'Export project JSON' })).toBeVisible();
  await expect(page.getByText('Exact verification: pass')).toBeVisible();
  await expect(page.getByText('Design runnable')).toBeVisible();
});
