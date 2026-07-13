import type {
  FusionDesign,
  PrimerDesign,
  ReviewItem,
  ReviewSeverity,
} from './fusion-model';

const severityRank: Record<ReviewSeverity, number> = {
  blocking: 0,
  warning: 1,
  review: 2,
  information: 3,
};

type ReviewItemInput = Omit<ReviewItem, 'id'> & { id?: string };

function sanitizeReviewToken(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  );
}

export function createReviewItem(input: ReviewItemInput): ReviewItem {
  const baseId = input.id ?? input.deduplicationKey;
  return {
    ...input,
    id: sanitizeReviewToken(baseId),
  };
}

export function deduplicateReviewItems(items: ReviewItem[]): ReviewItem[] {
  const deduplicated = new Map<string, ReviewItem>();

  for (const item of items) {
    const current = deduplicated.get(item.deduplicationKey);
    if (!current) {
      deduplicated.set(item.deduplicationKey, item);
      continue;
    }

    const currentSeverity = severityRank[current.severity];
    const nextSeverity = severityRank[item.severity];
    if (nextSeverity < currentSeverity) {
      deduplicated.set(item.deduplicationKey, item);
    }
  }

  return Array.from(deduplicated.values());
}

export function sortReviewItems(items: ReviewItem[]): ReviewItem[] {
  return [...items].sort((left, right) => {
    const severityDelta =
      severityRank[left.severity] - severityRank[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const scopeDelta = left.scope.localeCompare(right.scope);
    if (scopeDelta !== 0) {
      return scopeDelta;
    }

    const titleDelta = left.title.localeCompare(right.title);
    if (titleDelta !== 0) {
      return titleDelta;
    }

    return left.recommendedAction.localeCompare(right.recommendedAction);
  });
}

export function summarizeReviewItem(item: ReviewItem): string {
  return item.title;
}

export function filterActionableReviewItems(items: ReviewItem[]): ReviewItem[] {
  return items.filter((item) => item.severity !== 'information');
}

export function countReviewItemsBySeverity(
  items: ReviewItem[],
  severity: ReviewSeverity,
): number {
  return items.filter((item) => item.severity === severity).length;
}

export function getPrimerReviewItems(
  design: FusionDesign,
  primerName: string,
): ReviewItem[] {
  return design.reviewItems.filter(
    (item) => item.relatedObjectId === primerName,
  );
}

export function countPrimerScopedReviewItems(design: FusionDesign): number {
  const primerNames = new Set(design.primers.map((primer) => primer.name));
  return filterActionableReviewItems(design.reviewItems).filter(
    (item) =>
      item.relatedObjectId !== null && primerNames.has(item.relatedObjectId),
  ).length;
}

export function summarizePrimerReviewStatus(
  primer: PrimerDesign,
  reviewItems: ReviewItem[],
): { label: string; tone: 'success' | 'watch' | 'alert' } {
  const relevantItems = reviewItems.filter(
    (item) => item.relatedObjectId === primer.name,
  );
  if (
    relevantItems.some(
      (item) => item.severity === 'warning' || item.severity === 'blocking',
    )
  ) {
    return { label: 'Review', tone: 'alert' };
  }
  if (relevantItems.some((item) => item.severity === 'review')) {
    return { label: 'Watch', tone: 'watch' };
  }
  return { label: 'Ready', tone: 'success' };
}
