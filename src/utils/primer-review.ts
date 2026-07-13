import type { PrimerPairInteraction, ReactionPlan } from './fusion-model';
import type { PrimerDesign } from './fusion-model';
import type { SpecificitySite } from './specificity';

export function getIntendedTemplateIdsForPrimer(
  primer: Pick<PrimerDesign, 'name' | 'expectedTemplateId'>,
): Set<string> {
  const templateIds = new Set<string>([primer.expectedTemplateId]);

  if (primer.name.startsWith('A_')) {
    templateIds.add('stage-a');
    templateIds.add('final-product');
  }

  if (primer.name.startsWith('B_')) {
    templateIds.add('stage-b');
    templateIds.add('final-product');
  }

  return templateIds;
}

export function isIntendedPrimerSpecificitySite(
  primer: Pick<
    PrimerDesign,
    'name' | 'expectedTemplateId' | 'bodyTemplateSequence'
  >,
  site: Pick<SpecificitySite, 'templateId' | 'matchedSequence'>,
): boolean {
  return (
    getIntendedTemplateIdsForPrimer(primer).has(site.templateId) &&
    site.matchedSequence === primer.bodyTemplateSequence
  );
}

export function getNonIntendedSpecificitySites(
  primer: PrimerDesign,
): SpecificitySite[] {
  return primer.specificitySites.filter(
    (site) =>
      site.risk !== 'low' && !isIntendedPrimerSpecificitySite(primer, site),
  );
}

export function primerPairSharesReaction(
  pair: Pick<PrimerPairInteraction, 'primerAName' | 'primerBName'>,
  reactions: Array<Pick<ReactionPlan, 'primerNames'>>,
): boolean {
  return reactions.some(
    (reaction) =>
      reaction.primerNames.includes(pair.primerAName) &&
      reaction.primerNames.includes(pair.primerBName),
  );
}
