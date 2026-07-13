import type { ComparisonSnapshot } from '../hooks/useProjectController';
import type { FusionDesign, FusionProjectInput } from './fusion';
import type { DesignComparisonSummary } from './review';

export type StepStatusLevel = 'complete' | 'warning' | 'error' | 'pending';
export type StepStatus = { level: StepStatusLevel; text: string };
export type CompareRow = {
  label: string;
  current: string;
  baseline: string;
};

export function formatStepStatus(level: StepStatusLevel, text: string) {
  switch (level) {
    case 'complete':
      return `✓ ${text}`;
    case 'warning':
      return `! ${text}`;
    case 'error':
      return `× ${text}`;
    default:
      return `○ ${text}`;
  }
}

export function getActiveFocusableElement() {
  if (typeof document === 'undefined') {
    return null;
  }

  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

export function isEditableElement(element: HTMLElement | null) {
  if (!element) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || element.isContentEditable;
}

export function focusInspectorPanel() {
  window.setTimeout(() => {
    const retryButton = Array.from(document.querySelectorAll('.inspector-pane button')).find((button) =>
      button.textContent?.includes('Retry'),
    );
    if (retryButton instanceof HTMLElement && retryButton.textContent?.includes('Retry')) {
      retryButton.focus();
      return;
    }

    const heading = document.querySelector('.inspector-pane h2');
    if (heading instanceof HTMLElement) {
      heading.focus();
    }
  }, 220);
}

export function buildStepStatuses({
  project,
  design,
  blockingReviewCount,
  actionableReviewCount,
  primerScopedReviewCount,
}: {
  project: FusionProjectInput;
  design: FusionDesign;
  blockingReviewCount: number;
  actionableReviewCount: number;
  primerScopedReviewCount: number;
}): {
  sequenceStepStatus: StepStatus;
  constructStepStatus: StepStatus;
  primerStepStatus: StepStatus;
  protocolStepStatus: StepStatus;
} {
  const sequenceStepStatus: StepStatus =
    project.fragmentA.sequence.trim() && project.fragmentB.sequence.trim()
      ? { level: 'complete', text: 'Two sequences loaded' }
      : project.fragmentA.sequence.trim() || project.fragmentB.sequence.trim()
        ? { level: 'warning', text: 'One fragment still missing' }
        : { level: 'pending', text: 'No sequences loaded' };
  const constructStepStatus: StepStatus = blockingReviewCount
    ? { level: 'error', text: `${blockingReviewCount} blocking issue(s)` }
    : design.finalProductVerified
      ? { level: 'complete', text: 'Target verified' }
      : { level: 'pending', text: 'Target not yet verified' };
  const primerStepStatus: StepStatus = !design.primers.length
    ? { level: 'pending', text: 'No primer set yet' }
    : primerScopedReviewCount
      ? { level: 'warning', text: `${primerScopedReviewCount} primer review item(s)` }
      : { level: 'complete', text: `${design.primers.length} primers ready` };
  const protocolStepStatus: StepStatus = !design.reactions.length
    ? { level: 'pending', text: 'Protocol not reviewed' }
    : blockingReviewCount
      ? { level: 'warning', text: 'Protocol blocked by design issues' }
      : actionableReviewCount
        ? { level: 'warning', text: `${actionableReviewCount} review item(s)` }
        : { level: 'complete', text: `${design.reactions.length} reactions planned` };

  return {
    sequenceStepStatus,
    constructStepStatus,
    primerStepStatus,
    protocolStepStatus,
  };
}

export function buildCompareRows(
  comparisonMetrics: DesignComparisonSummary,
  comparisonSnapshot: ComparisonSnapshot | null,
): CompareRow[] {
  return [
    {
      label: 'Total oligo nt',
      current: String(comparisonMetrics.totalOligoLength),
      baseline: comparisonSnapshot ? String(comparisonSnapshot.metrics.totalOligoLength) : 'n/a',
    },
    {
      label: 'Worst dimer dG',
      current: comparisonMetrics.worstDimerDeltaG !== null ? comparisonMetrics.worstDimerDeltaG.toFixed(1) : 'n/a',
      baseline:
        comparisonSnapshot && comparisonSnapshot.metrics.worstDimerDeltaG !== null
          ? comparisonSnapshot.metrics.worstDimerDeltaG.toFixed(1)
          : 'n/a',
    },
    {
      label: 'Tm spread',
      current: `${comparisonMetrics.tmSpread.toFixed(1)} C`,
      baseline: comparisonSnapshot ? `${comparisonSnapshot.metrics.tmSpread.toFixed(1)} C` : 'n/a',
    },
    {
      label: 'Overlap Tm',
      current: comparisonMetrics.overlapTm !== null ? `${comparisonMetrics.overlapTm.toFixed(1)} C` : 'n/a',
      baseline:
        comparisonSnapshot && comparisonSnapshot.metrics.overlapTm !== null
          ? `${comparisonSnapshot.metrics.overlapTm.toFixed(1)} C`
          : 'n/a',
    },
    {
      label: 'Local off-targets',
      current: String(comparisonMetrics.localOffTargets),
      baseline: comparisonSnapshot ? String(comparisonSnapshot.metrics.localOffTargets) : 'n/a',
    },
  ];
}
