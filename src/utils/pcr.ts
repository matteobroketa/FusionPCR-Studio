export type PrimerMetrics = {
  sequence: string;
  length: number;
  gcPercentage: number;
  reverseComplement: string;
  wallaceTm: number;
  invalidBases: string[];
  isEmpty: boolean;
};

export type AmpliconResult = {
  forwardSite: number;
  reverseSite: number;
  end: number;
  length: number;
  sequence: string;
  reverseBindingSequence: string;
  forwardSiteCount: number;
  reverseSiteCount: number;
};

const COMPLEMENTS: Record<string, string> = {
  A: 'T',
  C: 'G',
  G: 'C',
  T: 'A',
  N: 'N',
};

export function normalizeSequence(input: string): string {
  return input.toUpperCase().replace(/\s+/g, '');
}

export function findInvalidBases(input: string, allowN = true): string[] {
  const normalized = normalizeSequence(input);
  const pattern = allowN ? /[^ACGTN]/g : /[^ACGT]/g;
  return Array.from(new Set(normalized.match(pattern) ?? []));
}

export function reverseComplement(input: string): string {
  const sequence = normalizeSequence(input);
  return sequence
    .split('')
    .reverse()
    .map((base) => COMPLEMENTS[base] ?? 'N')
    .join('');
}

export function calculateGcPercentage(input: string): number {
  const sequence = normalizeSequence(input);
  if (!sequence.length) {
    return 0;
  }

  const gcCount = sequence.split('').filter((base) => base === 'G' || base === 'C').length;
  return Number(((gcCount / sequence.length) * 100).toFixed(1));
}

export function calculateWallaceTm(input: string): number {
  const sequence = normalizeSequence(input);
  const baseCounts = sequence.split('').reduce(
    (counts, base) => {
      counts[base] = (counts[base] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>,
  );

  return 2 * ((baseCounts.A ?? 0) + (baseCounts.T ?? 0)) + 4 * ((baseCounts.G ?? 0) + (baseCounts.C ?? 0));
}

export function analyzePrimer(input: string): PrimerMetrics {
  const sequence = normalizeSequence(input);
  const invalidBases = findInvalidBases(input, false);

  return {
    sequence,
    length: sequence.length,
    gcPercentage: calculateGcPercentage(sequence),
    reverseComplement: sequence ? reverseComplement(sequence) : '',
    wallaceTm: calculateWallaceTm(sequence),
    invalidBases,
    isEmpty: sequence.length === 0,
  };
}

export function findBindingSites(templateInput: string, queryInput: string): number[] {
  const template = normalizeSequence(templateInput);
  const query = normalizeSequence(queryInput);

  if (!template.length || !query.length || query.length > template.length) {
    return [];
  }

  const sites: number[] = [];

  for (let index = 0; index <= template.length - query.length; index += 1) {
    if (template.slice(index, index + query.length) === query) {
      sites.push(index);
    }
  }

  return sites;
}

export function estimateAmplicon(
  templateInput: string,
  forwardInput: string,
  reverseInput: string,
): AmpliconResult | null {
  const template = normalizeSequence(templateInput);
  const forwardPrimer = normalizeSequence(forwardInput);
  const reversePrimer = normalizeSequence(reverseInput);

  if (!template.length || !forwardPrimer.length || !reversePrimer.length) {
    return null;
  }

  if (
    findInvalidBases(template).length ||
    findInvalidBases(forwardPrimer, false).length ||
    findInvalidBases(reversePrimer, false).length
  ) {
    return null;
  }

  const forwardSites = findBindingSites(template, forwardPrimer);
  const reverseBindingSequence = reverseComplement(reversePrimer);
  const reverseSites = findBindingSites(template, reverseBindingSequence);

  let bestMatch: AmpliconResult | null = null;

  for (const forwardSite of forwardSites) {
    for (const reverseSite of reverseSites) {
      const end = reverseSite + reverseBindingSequence.length;
      const length = end - forwardSite;

      if (reverseSite < forwardSite || length <= 0) {
        continue;
      }

      const candidate: AmpliconResult = {
        forwardSite,
        reverseSite,
        end,
        length,
        sequence: template.slice(forwardSite, end),
        reverseBindingSequence,
        forwardSiteCount: forwardSites.length,
        reverseSiteCount: reverseSites.length,
      };

      if (!bestMatch || candidate.length < bestMatch.length) {
        bestMatch = candidate;
      }
    }
  }

  return bestMatch;
}
