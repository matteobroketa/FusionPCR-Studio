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
    await expect(page.getByText(/Fragment A contains unsupported bases: B/)).toBeVisible();
    await expect(page.getByText('2 issue(s)')).toBeVisible();
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
});
