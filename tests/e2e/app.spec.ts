import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, loadRunnableExample, openWorkbenchStep, test } from './fixtures';

test.describe('FusionPCR Studio production build', () => {
  test('starts the design worker, renders a runnable example, and loads every built-in example', async ({ page }) => {
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
      { id: 'insertion', name: 'Insertion example' },
      { id: 'mutation', name: 'Substitution example' },
    ];

    for (const example of examples) {
      await page.getByLabel('Example library').selectOption(example.id);
      await page.getByRole('button', { name: 'Load selected example' }).click();
      await expect(projectName).toHaveValue(example.name);
    }
  });

  test('renders blocking issues instead of a runnable design for invalid sequence input', async ({ page }) => {
    await page.goto('./');
    await loadRunnableExample(page);
    await openWorkbenchStep(page, 'Sequences');

    await page.getByPlaceholder('Paste fragment A DNA sequence').fill('ATGB');
    await openWorkbenchStep(page, 'Construct');

    await expect(page.getByText('Awaiting valid design')).toBeVisible();
    await expect(page.getByText(/Fragment A contains unsupported bases: B/)).toBeVisible();
    await expect(page.getByText('2 issue(s)')).toBeVisible();
  });

  test('exports every principal artifact from the production build', async ({ page }, testInfo) => {
    await page.goto('./');
    await loadRunnableExample(page);
    await openWorkbenchStep(page, 'Export');

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
        button: 'Export oligo-ordering CSV',
        filename: 'fusionpcr-primers.csv',
        assertContent: (content) => expect(content).toContain('name,reaction,sequence'),
      },
      {
        button: 'Export primer FASTA',
        filename: 'fusionpcr-primers.fasta',
        assertContent: (content) => expect(content).toContain('>A_outer_F'),
      },
      {
        button: 'Export final FASTA',
        filename: 'fusionpcr-final-construct.fasta',
        assertContent: (content) => expect(content).toContain('>'),
      },
      {
        button: 'Export stage-product FASTA',
        filename: 'fusionpcr-stage-products.fasta',
        assertContent: (content) => expect(content).toContain('PCR_1A_product'),
      },
      {
        button: 'Export annotated GenBank',
        filename: 'fusionpcr-construct.gb',
        assertContent: (content) => expect(content).toContain('LOCUS'),
      },
      {
        button: 'Export protocol',
        filename: 'fusionpcr-protocol.txt',
        assertContent: (content) => expect(content).toContain('FusionPCR Studio'),
      },
      {
        button: 'Export pipetting table',
        filename: 'fusionpcr-pipetting-table.csv',
        assertContent: (content) => expect(content).toContain('section,reaction,role,item'),
      },
      {
        button: 'Export thermocycler program',
        filename: 'fusionpcr-thermocycler-program.txt',
        assertContent: (content) => expect(content).toContain('PCR 1A'),
      },
      {
        button: 'Export junction report',
        filename: 'fusionpcr-junction-report.txt',
        assertContent: (content) => expect(content).toContain('Final junction'),
      },
      {
        button: 'Export validation report',
        filename: 'fusionpcr-validation-report.txt',
        assertContent: (content) => expect(content).toContain('Exact fusion verified'),
      },
      {
        button: 'Export expected gel',
        filename: 'fusionpcr-expected-gel.txt',
        assertContent: (content) => expect(content).toContain('Lane 1'),
      },
      {
        button: 'Export calculation manifest',
        filename: 'fusionpcr-calculation-manifest.json',
        assertContent: (content) => {
          const parsed = JSON.parse(content) as { engineVersion: string; quality: { score: number } };
          expect(parsed.engineVersion).toContain('0.1.0-alpha');
          expect(parsed.quality.score).toBeGreaterThan(0);
        },
      },
      {
        button: 'Export Primer-BLAST handoff',
        filename: 'fusionpcr-primer-blast-handoff.txt',
        assertContent: (content) => expect(content).toContain('Primer-BLAST'),
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
