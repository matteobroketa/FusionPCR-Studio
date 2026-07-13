import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  loadRunnableExample,
  openWorkbenchStep,
  test,
} from './fixtures';

async function expectNoSeriousOrCriticalViolations(
  page: Parameters<typeof AxeBuilder>[0]['page'],
) {
  const results = await new AxeBuilder({ page }).analyze();
  const blockingViolations = results.violations.filter(
    (violation) =>
      violation.impact === 'serious' || violation.impact === 'critical',
  );

  expect(
    blockingViolations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([]);
}

test.describe('FusionPCR Studio accessibility', () => {
  test('empty state has no serious or critical axe violations', async ({
    page,
  }) => {
    await page.goto('./');
    await expectNoSeriousOrCriticalViolations(page);
  });

  test('Sequences step has no serious or critical axe violations', async ({
    page,
  }) => {
    await page.goto('./');
    await loadRunnableExample(page);
    await openWorkbenchStep(page, 'Sequences');
    await expectNoSeriousOrCriticalViolations(page);
  });

  test('Junction step has no serious or critical axe violations', async ({
    page,
  }) => {
    await page.goto('./');
    await loadRunnableExample(page);
    await openWorkbenchStep(page, 'Junction');
    await expectNoSeriousOrCriticalViolations(page);
  });

  test('Primers step has no serious or critical axe violations', async ({
    page,
  }) => {
    await page.goto('./');
    await loadRunnableExample(page);
    await openWorkbenchStep(page, 'Primers');
    await expectNoSeriousOrCriticalViolations(page);
  });

  test('Protocol and Export step has no serious or critical axe violations', async ({
    page,
  }) => {
    await page.goto('./');
    await loadRunnableExample(page);
    await openWorkbenchStep(page, 'Protocol & Export');
    await expectNoSeriousOrCriticalViolations(page);
  });
});
