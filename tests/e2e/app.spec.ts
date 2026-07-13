import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, loadRunnableExample, openWorkbenchStep, test } from './fixtures';

test.describe('FusionPCR Studio production build', () => {
  test('starts the design worker, renders a runnable example, and loads the supported built-in examples', async ({ page }) => {
    const workerPromise = page.waitForEvent('worker');
    await page.goto('./');

    const worker = await workerPromise;
    expect(worker.url()).toContain('design.worker');

    await loadRunnableExample(page);
    await openWorkbenchStep(page, 'Primers');
    await expect(page.getByRole('heading', { name: 'A_outer_F', exact: true })).toBeVisible();
    await expect(page.getByText('Primer results')).toBeVisible();

    const projectName = page.getByLabel('Project name');
    const examples = [
      { id: 'protein-fusion', name: 'Protein fusion demo' },
      { id: 'exact-fusion', name: 'Exact fusion example' },
    ];

    for (const example of examples) {
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('menuitem', { name: example.id === 'exact-fusion' ? 'Load exact fusion example' : 'Load protein fusion example' }).click();
      const confirmButton = page.getByRole('button', { name: 'Load built-in example' });
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
      }
      await expect(projectName).toHaveValue(example.name);
    }
  });

  test('renders blocking issues instead of a runnable design for invalid sequence input', async ({ page }) => {
    await page.goto('./');
    await loadRunnableExample(page);
    await openWorkbenchStep(page, 'Sequences');

    await page.getByPlaceholder('Paste fragment A DNA sequence').fill('ATGB');
    await openWorkbenchStep(page, 'Junction');

    await expect(page.getByText('Calculation pending')).toBeVisible();
    await expect(page.getByText('Review issues')).toBeVisible();
    await expect(page.getByText(/Fragment A contains unsupported bases: B/)).toBeVisible();
    await expect(page.getByText('2 item(s) need review')).toBeVisible();
  });

  test('exports the public MVP artifacts from the production build', async ({ page }, testInfo) => {
    await page.goto('./');
    await loadRunnableExample(page);
    await openWorkbenchStep(page, 'Protocol & Export');

    const exportExpectations: Array<{
      button: string;
      filename: string;
      assertContent: (content: string) => void;
    }> = [
      {
        button: 'Export project JSON',
        filename: 'fusionpcr-project.json',
        assertContent: (content) => {
          const parsed = JSON.parse(content) as { schemaVersion: string; engineVersion: string; name: string };
          expect(parsed.schemaVersion).toContain('0.1.0-alpha');
          expect(parsed.engineVersion).toContain('0.1.0-alpha');
          expect(parsed.name.length).toBeGreaterThan(0);
        },
      },
      {
        button: 'Download oligo CSV',
        filename: 'fusionpcr-primers.csv',
        assertContent: (content) => expect(content).toContain('name,reaction,sequence'),
      },
      {
        button: 'Export primer FASTA',
        filename: 'fusionpcr-primers.fasta',
        assertContent: (content) => expect(content).toContain('>A_outer_F'),
      },
      {
        button: 'Export final construct FASTA',
        filename: 'fusionpcr-final-construct.fasta',
        assertContent: (content) => expect(content).toContain('>'),
      },
      {
        button: 'Export printable protocol',
        filename: 'fusionpcr-protocol.txt',
        assertContent: (content) => expect(content).toContain('FusionPCR Studio'),
      },
    ];

    for (const exportCase of exportExpectations) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: exportCase.button }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe(exportCase.filename);

      const targetPath = testInfo.outputPath(path.basename(exportCase.filename));
      await download.saveAs(targetPath);
      const content = readFileSync(targetPath, 'utf8');

      expect(content.length).toBeGreaterThan(0);
      expect(content).not.toMatch(/\b(?:NaN|-?Infinity)\b/);
      exportCase.assertContent(content);
    }
  });

  test('keeps global design warnings out of the contextual inspector', async ({ page }) => {
    await page.goto('./');
    await loadRunnableExample(page);

    await page.locator('.block-insert').click();

    await expect(page.getByText('Review issues')).toBeVisible();
    await expect(page.getByText('Upstream stop codon removal is proposed but not yet approved.')).toBeVisible();
    await expect(page.locator('.inspector-pane').getByText('Upstream stop codon removal is proposed but not yet approved.')).toHaveCount(0);
    await expect(page.locator('.inspector-pane').getByText('Scientific scope')).toHaveCount(0);
  });

  test('renders a recoverable worker error and recalculates after Retry', async ({ page }) => {
    await page.route('**/*design.worker*.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'throw new Error("forced worker failure");',
      }),
    );
    await page.goto('./');
    await page.getByRole('button', { name: 'Load protein fusion example' }).click();

    await expect(page.getByText('Design worker failed. Review the project and use Retry to calculate again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry calculation' })).toBeVisible();

    await page.unroute('**/*design.worker*.js');
    await page.getByRole('button', { name: 'Retry calculation' }).click();

    await expect(page.getByText('Sequence reconstruction verified.')).toBeVisible();
    await expect(page.getByText('Design worker failed. Review the project and use Retry to calculate again.')).toHaveCount(0);
  });
});

test.describe('FusionPCR Studio responsive review', () => {
  test.describe.configure({ mode: 'serial' });

  test('keeps the workflow step bar visible on tablet without relying on a Show steps toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('./');
    await loadRunnableExample(page);

    await expect(page.getByRole('button', { name: 'Sequences step' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Junction step' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Primers step' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Protocol & Export step' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show steps' })).toHaveCount(0);
  });

  test('shows read-only phone review and one primer detail at a time', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    await loadRunnableExample(page);

    await openWorkbenchStep(page, 'Sequences');
    await expect(page.getByText('Use a tablet or desktop to edit sequence designs.')).toBeVisible();
    await expect(page.getByPlaceholder('Paste fragment A DNA sequence')).toHaveCount(0);

    await openWorkbenchStep(page, 'Primers');
    await expect(page.locator('.phone-primer-selector')).toBeVisible();
    await expect(page.locator('.phone-primer-detail .primer-card')).toHaveCount(1);

    await page.getByRole('button', { name: 'B_outer_R' }).click();
    await expect(page.locator('.phone-primer-detail .primer-card')).toHaveCount(1);
    await expect(page.locator('.phone-primer-detail').getByRole('heading', { name: 'B_outer_R', exact: true })).toBeVisible();
  });
});
