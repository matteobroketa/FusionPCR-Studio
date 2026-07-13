import { expect, loadRunnableExample, openWorkbenchStep, test } from './fixtures';

test('public Pages deployment loads without browser/runtime faults', async ({ page }) => {
  await page.goto('./');
  await loadRunnableExample(page);
  await openWorkbenchStep(page, 'Protocol & Export');

  await expect(page.getByRole('button', { name: 'Export project JSON' })).toBeVisible();
  await expect(page.getByText('Sequence reconstruction verified: pass')).toBeVisible();
  await expect(page.locator('header').getByText('Calculation complete')).toBeVisible();
});
