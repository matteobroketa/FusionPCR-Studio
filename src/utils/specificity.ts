import { normalizeSequence, reverseComplement } from './pcr';

export type PrimerDirection = 'forward' | 'reverse';

export type SpecificityTemplate = {
  id: string;
  name: string;
  sequence: string;
  kind: 'imported' | 'reverse-complement' | 'final-product' | 'stage-product';
};

export type SpecificitySite = {
  templateId: string;
  templateName: string;
  templateKind: SpecificityTemplate['kind'];
  start: number;
  end: number;
  mismatches: number[];
  mismatchCount: number;
  weightedMismatchPenalty: number;
  threePrimeMatchedBases: number;
  matchedSequence: string;
  primerOrientedSequence: string;
  risk: 'low' | 'watch' | 'high';
};

export type OffTargetAmplicon = {
  templateId: string;
  templateName: string;
  forwardPrimerName: string;
  reversePrimerName: string;
  start: number;
  end: number;
  length: number;
  risk: 'watch' | 'high';
  sequencePreview: string;
};

function comparePrimerBinding(
  primerBodyInput: string,
  matchedTemplateSliceInput: string,
  direction: PrimerDirection,
): {
  mismatches: number[];
  weightedMismatchPenalty: number;
  threePrimeMatchedBases: number;
  primerOrientedSequence: string;
} {
  const primerBody = normalizeSequence(primerBodyInput);
  const matchedTemplateSlice = normalizeSequence(matchedTemplateSliceInput);
  const primerOrientedSequence =
    direction === 'forward'
      ? matchedTemplateSlice
      : reverseComplement(matchedTemplateSlice);
  const mismatches: number[] = [];
  let weightedMismatchPenalty = 0;
  let threePrimeMatchedBases = 0;

  for (let index = 0; index < primerBody.length; index += 1) {
    if (primerBody[index] !== primerOrientedSequence[index]) {
      mismatches.push(index);
      const weight = 1 + (2 * index) / Math.max(primerBody.length - 1, 1);
      weightedMismatchPenalty += weight;
    }
  }

  for (let index = primerBody.length - 1; index >= 0; index -= 1) {
    if (primerBody[index] === primerOrientedSequence[index]) {
      threePrimeMatchedBases += 1;
    } else {
      break;
    }
  }

  return {
    mismatches,
    weightedMismatchPenalty,
    threePrimeMatchedBases,
    primerOrientedSequence,
  };
}

export function findPrimerSpecificitySites(
  primerName: string,
  primerBodyInput: string,
  direction: PrimerDirection,
  templates: SpecificityTemplate[],
  seedLength = 8,
): SpecificitySite[] {
  const primerBody = normalizeSequence(primerBodyInput);
  if (!primerBody.length) {
    return [];
  }

  const bindingSequence =
    direction === 'forward' ? primerBody : reverseComplement(primerBody);
  const effectiveSeedLength = Math.min(seedLength, bindingSequence.length);
  const seed =
    direction === 'forward'
      ? bindingSequence.slice(-effectiveSeedLength)
      : bindingSequence.slice(0, effectiveSeedLength);
  const sites: SpecificitySite[] = [];

  for (const template of templates) {
    const templateSequence = normalizeSequence(template.sequence);
    if (templateSequence.length < bindingSequence.length) {
      continue;
    }

    for (
      let index = 0;
      index <= templateSequence.length - effectiveSeedLength;
      index += 1
    ) {
      if (templateSequence.slice(index, index + effectiveSeedLength) !== seed) {
        continue;
      }

      const candidateStart =
        direction === 'forward'
          ? index - (bindingSequence.length - effectiveSeedLength)
          : index;
      if (
        candidateStart < 0 ||
        candidateStart + bindingSequence.length > templateSequence.length
      ) {
        continue;
      }

      const matchedSequence = templateSequence.slice(
        candidateStart,
        candidateStart + bindingSequence.length,
      );
      const comparison = comparePrimerBinding(
        primerBody,
        matchedSequence,
        direction,
      );
      const mismatchCount = comparison.mismatches.length;
      const risk =
        mismatchCount === 0 || comparison.threePrimeMatchedBases >= 7
          ? 'high'
          : comparison.threePrimeMatchedBases >= 5 ||
              comparison.weightedMismatchPenalty <= 2.5
            ? 'watch'
            : 'low';

      sites.push({
        templateId: template.id,
        templateName: template.name,
        templateKind: template.kind,
        start: candidateStart + 1,
        end: candidateStart + bindingSequence.length,
        mismatches: comparison.mismatches,
        mismatchCount,
        weightedMismatchPenalty: Number(
          comparison.weightedMismatchPenalty.toFixed(2),
        ),
        threePrimeMatchedBases: comparison.threePrimeMatchedBases,
        matchedSequence,
        primerOrientedSequence: comparison.primerOrientedSequence,
        risk,
      });
    }
  }

  return sites.sort((left, right) => {
    if (left.templateName !== right.templateName) {
      return left.templateName.localeCompare(right.templateName);
    }
    if (left.weightedMismatchPenalty !== right.weightedMismatchPenalty) {
      return left.weightedMismatchPenalty - right.weightedMismatchPenalty;
    }
    return left.start - right.start;
  });
}

export function predictOffTargetAmplicons(
  template: SpecificityTemplate,
  forwardPrimerName: string,
  forwardSites: SpecificitySite[],
  reversePrimerName: string,
  reverseSites: SpecificitySite[],
): OffTargetAmplicon[] {
  const templateSequence = normalizeSequence(template.sequence);
  const amplicons: OffTargetAmplicon[] = [];
  const forwardTemplateSites = forwardSites.filter(
    (site) => site.templateId === template.id && site.risk !== 'low',
  );
  const reverseTemplateSites = reverseSites.filter(
    (site) => site.templateId === template.id && site.risk !== 'low',
  );

  for (const forwardSite of forwardTemplateSites) {
    for (const reverseSite of reverseTemplateSites) {
      if (forwardSite.start >= reverseSite.start) {
        continue;
      }

      const length = reverseSite.end - forwardSite.start + 1;
      if (length <= 0 || length > 5000) {
        continue;
      }

      const risk =
        forwardSite.risk === 'high' &&
        reverseSite.risk === 'high' &&
        forwardSite.mismatchCount === 0 &&
        reverseSite.mismatchCount === 0
          ? 'high'
          : 'watch';
      const sequencePreview = templateSequence.slice(
        forwardSite.start - 1,
        Math.min(reverseSite.end, forwardSite.start - 1 + 120),
      );

      amplicons.push({
        templateId: template.id,
        templateName: template.name,
        forwardPrimerName,
        reversePrimerName,
        start: forwardSite.start,
        end: reverseSite.end,
        length,
        risk,
        sequencePreview,
      });
    }
  }

  return amplicons.sort((left, right) => left.length - right.length);
}
