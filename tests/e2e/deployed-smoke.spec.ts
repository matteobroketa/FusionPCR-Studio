import { expect, test, waitForDesignReady } from './fixtures';

test('public Pages deployment loads without browser/runtime faults', async ({ page }) => {
  await page.goto('./');
  await waitForDesignReady(page);

  await expect(page.getByRole('button', { name: 'Export project JSON' })).toBeVisible();
  await expect(page.getByText('Exact product verified')).toBeVisible();
  await expect(page.getByText('Design runnable')).toBeVisible();
});
