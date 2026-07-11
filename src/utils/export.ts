import { checksumSequence, type FragmentInput, type FusionDesign, type FusionProjectInput, type PrimerDesign } from './fusion';
import { buildJunctionSummary } from './review';

const FASTA_LINE_WIDTH = 80;

type ExportFeature = {
  key: string;
  location: string;
  qualifiers: Record<string, string>;
};

type FeatureMappingSummary = {
  mapped: ExportFeature[];
  skipped: number;
  skippedReason?: string;
};

type ValidationSummary = {
  exactFusionVerified: boolean;
  targetLengthBp: number;
  finalProductLengthBp: number;
  targetChecksum: string;
  finalChecksum: string;
  issueCount: number;
  warningCount: number;
  localOffTargetAmplicons: number;
  highRiskSpecificitySites: number;
  watchSpecificitySites: number;
  highRiskPrimerPairInteractions: number;
};

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/["\n,]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function wrapSequence(sequence: string, width = FASTA_LINE_WIDTH): string {
  if (!sequence.length) {
    return '';
  }

  const lines: string[] = [];
  for (let index = 0; index < sequence.length; index += width) {
    lines.push(sequence.slice(index, index + width));
  }
  return lines.join('\n');
}

function formatFastaRecord(header: string, sequence: string): string {
  return `>${header}\n${wrapSequence(sequence)}`;
}

function findPrimer(design: FusionDesign, primerName: string): PrimerDesign | null {
  return design.primers.find((primer) => primer.name === primerName) ?? null;
}

function formatPrimerRows(primers: PrimerDesign[]): string[] {
  return primers.map((primer) =>
    [
      csvEscape(primer.name),
      csvEscape(primer.reaction),
      csvEscape(primer.sequence),
      csvEscape(primer.tail),
      csvEscape(primer.body),
      primer.bodyLength,
      primer.bodyTm.toFixed(1),
      primer.fullOligoTm.toFixed(1),
      primer.overlapTm !== null ? primer.overlapTm.toFixed(1) : '',
      primer.bodyGcPercentage.toFixed(1),
      csvEscape(primer.structure.risk),
    ].join(','),
  );
}

function selectionCrossesOrigin(fragment: FragmentInput): boolean {
  return fragment.topology === 'circular' && fragment.start > fragment.end;
}

function selectionSpanLength(fragment: FragmentInput): number {
  const sequenceLength = fragment.sequence.length;
  if (!sequenceLength) {
    return 0;
  }

  if (!selectionCrossesOrigin(fragment)) {
    return Math.max(0, fragment.end - fragment.start + 1);
  }

  return (sequenceLength - fragment.start + 1) + fragment.end;
}

function sanitizeGenbankText(value: string): string {
  return value.replace(/"/g, "'").replace(/\s+/g, ' ').trim();
}

function sanitizeFeatureKey(key: string): string {
  return /^[A-Za-z_]+$/.test(key) ? key : 'misc_feature';
}

function parseSimpleFeatureLocation(location: string): { start: number; end: number; complement: boolean } | null {
  const complementMatch = location.match(/^complement\((<?\d+)\.\.(>?\d+)\)$/i);
  if (complementMatch) {
    return {
      start: Number.parseInt(complementMatch[1].replace(/[<>]/g, ''), 10),
      end: Number.parseInt(complementMatch[2].replace(/[<>]/g, ''), 10),
      complement: true,
    };
  }

  const simpleMatch = location.match(/^(<?\d+)\.\.(>?\d+)$/);
  if (!simpleMatch) {
    return null;
  }

  return {
    start: Number.parseInt(simpleMatch[1].replace(/[<>]/g, ''), 10),
    end: Number.parseInt(simpleMatch[2].replace(/[<>]/g, ''), 10),
    complement: false,
  };
}

function mapFragmentFeatures(
  fragment: FragmentInput,
  constructStart: number,
  selectedLength: number,
  effectiveLength: number,
): FeatureMappingSummary {
  if (!fragment.features.length) {
    return { mapped: [], skipped: 0 };
  }

  if (selectedLength !== effectiveLength) {
    return {
      mapped: [],
      skipped: fragment.features.length,
      skippedReason: 'final construct sequence length differs from the selected source span after approved edits',
    };
  }

  if (selectionCrossesOrigin(fragment)) {
    return {
      mapped: [],
      skipped: fragment.features.length,
      skippedReason: 'selected source span crosses the circular origin',
    };
  }

  const mapped: ExportFeature[] = [];
  let skipped = 0;

  for (const feature of fragment.features) {
    const parsed = parseSimpleFeatureLocation(feature.location);
    if (!parsed || feature.crossesOrigin) {
      skipped += 1;
      continue;
    }

    if (parsed.start < fragment.start || parsed.end > fragment.end) {
      skipped += 1;
      continue;
    }

    const mappedStart = constructStart + (parsed.start - fragment.start);
    const mappedEnd = constructStart + (parsed.end - fragment.start);
    const location = parsed.complement ? `complement(${mappedStart}..${mappedEnd})` : `${mappedStart}..${mappedEnd}`;
    const qualifiers: Record<string, string> = {
      label: feature.label || feature.key,
      note: `Imported from ${fragment.label}; original location ${feature.location}.`,
      source_format: fragment.sourceFormat,
    };

    for (const [qualifierKey, qualifierValue] of Object.entries(feature.qualifiers)) {
      if (!qualifierValue) {
        continue;
      }

      if (!(qualifierKey in qualifiers)) {
        qualifiers[qualifierKey] = qualifierValue;
      }
    }

    mapped.push({
      key: sanitizeFeatureKey(feature.key),
      location,
      qualifiers,
    });
  }

  return { mapped, skipped };
}

function formatGenbankDate(dateInput: string): string {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return '01-JAN-2000';
  }

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${String(date.getUTCDate()).padStart(2, '0')}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

function formatFeatureQualifiers(qualifiers: Record<string, string>): string[] {
  return Object.entries(qualifiers)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => `                     /${key}="${sanitizeGenbankText(value)}"`);
}

function formatGenbankFeature(feature: ExportFeature): string[] {
  return [`     ${feature.key.padEnd(15)}${feature.location}`, ...formatFeatureQualifiers(feature.qualifiers)];
}

function formatOrigin(sequence: string): string[] {
  const normalized = sequence.toLowerCase();
  const lines: string[] = [];

  for (let index = 0; index < normalized.length; index += 60) {
    const chunk = normalized.slice(index, index + 60);
    const groups = chunk.match(/.{1,10}/g)?.join(' ') ?? chunk;
    lines.push(`${String(index + 1).padStart(9)} ${groups}`);
  }

  return lines;
}

function describeDesignWarnings(design: FusionDesign): string[] {
  return design.warnings.length ? design.warnings : ['No design warnings were emitted.'];
}

function buildThermocyclerBlock(design: FusionDesign, reactionName: 'PCR 1A' | 'PCR 1B' | 'Fusion PCR'): string[] {
  const reaction = design.reactions.find((entry) => entry.name === reactionName);
  if (!reaction) {
    return [];
  }

  const cycles =
    design.protocolPlan.reactionMixes.find((mix) => mix.name === reactionName)?.cycleCount ??
    (reactionName === 'Fusion PCR' ? design.project.protocolSettings.finalCycles : design.project.protocolSettings.stage1Cycles);

  return [
    reactionName,
    `1. Initial denaturation: 98 C for 30 s`,
    `2. Denaturation: 98 C for 10 s`,
    `3. Annealing: ${reaction.annealingTemperature} C for 20 s`,
    `4. Extension: 72 C for ${reaction.extensionSeconds} s`,
    `5. Repeat steps 2-4 for ${cycles} cycles total`,
    `6. Final extension: 72 C for 120 s`,
    `7. Hold: 4 C`,
  ];
}

function buildValidationSummary(design: FusionDesign): ValidationSummary {
  const highRiskSpecificitySites = design.primers.reduce(
    (total, primer) => total + primer.specificitySites.filter((site) => site.risk === 'high').length,
    0,
  );
  const watchSpecificitySites = design.primers.reduce(
    (total, primer) => total + primer.specificitySites.filter((site) => site.risk === 'watch').length,
    0,
  );

  return {
    exactFusionVerified: design.finalProductVerified,
    targetLengthBp: design.targetSequence.length,
    finalProductLengthBp: design.finalProduct.length,
    targetChecksum: checksumSequence(design.targetSequence),
    finalChecksum: checksumSequence(design.finalProduct),
    issueCount: design.issues.length,
    warningCount: design.warnings.length,
    localOffTargetAmplicons: design.offTargetAmplicons.length,
    highRiskSpecificitySites,
    watchSpecificitySites,
    highRiskPrimerPairInteractions: design.primerPairInteractions.filter((pair) => pair.interaction?.risk === 'High').length,
  };
}

function buildGelLane(label: string, productLength: number, maxLength: number): string {
  const width = 36;
  const position = Math.max(0, Math.min(width - 1, Math.round((productLength / Math.max(maxLength, 1)) * (width - 1))));
  const track = Array.from({ length: width }, (_, index) => (index === position ? '*' : '-')).join('');
  return `${label.padEnd(18)} ${track} ${productLength} bp`;
}

export function buildPrimerCsv(design: FusionDesign): string {
  return [
    'name,reaction,sequence,tail,body,body_length,body_tm_c,full_oligo_tm_c,overlap_tm_c,body_gc_percent,structure_risk',
    ...formatPrimerRows(design.primers),
  ].join('\n');
}

export function buildPrimerFasta(design: FusionDesign): string {
  return design.primers.map((primer) => formatFastaRecord(`${primer.name} ${primer.reaction}`, primer.sequence)).join('\n\n');
}

export function buildFinalConstructFasta(design: FusionDesign): string {
  return formatFastaRecord(`${design.project.name} final_construct length=${design.finalProduct.length}bp mode=${design.project.mode}`, design.finalProduct);
}

export function buildStageProductFasta(design: FusionDesign): string {
  return [
    formatFastaRecord(`${design.project.name} PCR_1A_product length=${design.stageAProduct.length}bp`, design.stageAProduct),
    formatFastaRecord(`${design.project.name} PCR_1B_product length=${design.stageBProduct.length}bp`, design.stageBProduct),
  ].join('\n\n');
}

export function buildProjectJson(project: FusionProjectInput): string {
  return JSON.stringify(project, null, 2);
}

export function buildAnnotatedGenbank(design: FusionDesign): string {
  const locusName = (design.project.name.replace(/[^A-Za-z0-9_]/g, '_') || 'fusionpcr').slice(0, 16);
  const constructLength = design.finalProduct.length;
  const selectedALength = selectionSpanLength(design.project.fragmentA);
  const selectedBLength = selectionSpanLength(design.project.fragmentB);
  const fragmentAStart = 1;
  const fragmentAEnd = design.effectiveSelectedA.length;
  const insertStart = fragmentAEnd + 1;
  const insertEnd = fragmentAEnd + design.insertSequence.length;
  const fragmentBStart = insertEnd + 1;
  const fragmentBEnd = constructLength;
  const mappedA = mapFragmentFeatures(design.project.fragmentA, fragmentAStart, selectedALength, design.effectiveSelectedA.length);
  const mappedB = mapFragmentFeatures(design.project.fragmentB, fragmentBStart, selectedBLength, design.effectiveSelectedB.length);

  const features: ExportFeature[] = [
    {
      key: 'source',
      location: `1..${Math.max(constructLength, 1)}`,
      qualifiers: {
        organism: 'synthetic DNA construct',
        mol_type: 'other DNA',
        note: `Generated by FusionPCR Studio ${design.project.engineVersion}.`,
      },
    },
  ];

  if (fragmentAEnd >= fragmentAStart) {
    features.push({
      key: 'misc_feature',
      location: `${fragmentAStart}..${fragmentAEnd}`,
      qualifiers: {
        label: design.project.fragmentA.label,
        note: `Selected from ${design.project.fragmentA.importedName || design.project.fragmentA.label} bases ${design.project.fragmentA.start}-${design.project.fragmentA.end}.`,
        checksum: design.project.fragmentA.checksum,
      },
    });
  }

  if (design.insertSequence.length) {
    features.push({
      key: 'misc_feature',
      location: `${insertStart}..${insertEnd}`,
      qualifiers: {
        label: design.project.mode === 'protein-fusion' ? 'Linker or inserted sequence' : 'Inserted sequence',
        note: `${design.project.mode} payload introduced between fragment contributions.`,
      },
    });
  }

  if (fragmentBEnd >= fragmentBStart) {
    features.push({
      key: 'misc_feature',
      location: `${fragmentBStart}..${fragmentBEnd}`,
      qualifiers: {
        label: design.project.fragmentB.label,
        note: `Selected from ${design.project.fragmentB.importedName || design.project.fragmentB.label} bases ${design.project.fragmentB.start}-${design.project.fragmentB.end}.`,
        checksum: design.project.fragmentB.checksum,
      },
    });
  }

  features.push(...mappedA.mapped, ...mappedB.mapped);

  const commentLines = [
    `FusionPCR Studio annotated construct export for ${design.project.name}.`,
    `Mode: ${design.project.mode}. Final product verified: ${design.finalProductVerified ? 'yes' : 'no'}.`,
    `Fragment A imported features mapped: ${mappedA.mapped.length}. Skipped: ${mappedA.skipped}${mappedA.skippedReason ? ` (${mappedA.skippedReason})` : ''}.`,
    `Fragment B imported features mapped: ${mappedB.mapped.length}. Skipped: ${mappedB.skipped}${mappedB.skippedReason ? ` (${mappedB.skippedReason})` : ''}.`,
  ];

  return [
    `LOCUS       ${locusName.padEnd(16)} ${String(constructLength).padStart(7)} bp    DNA     linear   SYN ${formatGenbankDate(design.project.modifiedAt)}`,
    `DEFINITION  FusionPCR Studio assembled construct for ${sanitizeGenbankText(design.project.name)}.`,
    'ACCESSION   .',
    'VERSION     .',
    'KEYWORDS    .',
    'SOURCE      synthetic DNA construct',
    '  ORGANISM  synthetic DNA construct',
    '            other sequences; artificial sequences.',
    `COMMENT     ${commentLines[0]}`,
    ...commentLines.slice(1).map((line) => `            ${line}`),
    'FEATURES             Location/Qualifiers',
    ...features.flatMap((feature) => formatGenbankFeature(feature)),
    'ORIGIN',
    ...formatOrigin(design.finalProduct),
    '//',
  ].join('\n');
}

export function buildPrimerBlastPackage(design: FusionDesign): string {
  const primerPairs = [
    {
      name: 'PCR 1A',
      forward: design.primers.find((primer) => primer.name === 'A_outer_F'),
      reverse: design.primers.find((primer) => primer.name === 'A_inner_R'),
      productLength: design.stageAProduct.length,
    },
    {
      name: 'PCR 1B',
      forward: design.primers.find((primer) => primer.name === 'B_inner_F'),
      reverse: design.primers.find((primer) => primer.name === 'B_outer_R'),
      productLength: design.stageBProduct.length,
    },
    {
      name: 'Fusion PCR',
      forward: design.primers.find((primer) => primer.name === 'A_outer_F'),
      reverse: design.primers.find((primer) => primer.name === 'B_outer_R'),
      productLength: design.finalProduct.length,
    },
  ].filter(
    (pair): pair is { name: string; forward: PrimerDesign; reverse: PrimerDesign; productLength: number } =>
      Boolean(pair.forward && pair.reverse),
  );

  return [
    `FusionPCR Studio Primer-BLAST handoff for ${design.project.name}`,
    '',
    'Disclosure',
    'Submitting these primers or targets to Primer-BLAST will send sequence information outside this local-first application.',
    '',
    'Primer-BLAST target',
    `Organism: ${design.project.genomicSpecificity.organism || 'not set'}`,
    `Database: ${design.project.genomicSpecificity.database || 'not set'}`,
    `Notes: ${design.project.genomicSpecificity.notes || 'none'}`,
    'Primer-BLAST URL: https://www.ncbi.nlm.nih.gov/tools/primer-blast/',
    '',
    'Primer pairs',
    ...primerPairs.flatMap((pair) => [
      `${pair.name}`,
      `Forward primer: ${pair.forward.sequence}`,
      `Reverse primer: ${pair.reverse.sequence}`,
      `Expected product length: ${pair.productLength} bp`,
      '',
    ]),
    'Project context',
    `Design mode: ${design.project.mode}`,
    `Requested target length: ${design.targetSequence.length} bp`,
    `Final simulated product length: ${design.finalProduct.length} bp`,
    `Local off-target amplicons: ${design.offTargetAmplicons.length}`,
    '',
    'Suggested submission steps',
    '1. Open the Primer-BLAST URL above.',
    '2. Select the organism and database listed in this handoff.',
    '3. Submit the intended primer pair for the stage you want to validate.',
    '4. Review unintended amplicons alongside the local specificity results in FusionPCR Studio.',
  ].join('\n');
}

export function buildProtocolText(design: FusionDesign): string {
  const reactionBlocks = design.reactions
    .map((reaction) => {
      const gradientLine = reaction.gradientRecommendation
        ? `Suggested gradient: ${reaction.gradientRecommendation}`
        : 'Suggested gradient: not required from current primer spread';

      return [
        reaction.name,
        `Primers: ${reaction.primerNames.join(' + ')}`,
        `Expected product length: ${reaction.productLength} bp`,
        `Starting annealing temperature: ${reaction.annealingTemperature} C`,
        `Extension time: ${reaction.extensionSeconds} s`,
        gradientLine,
      ].join('\n');
    })
    .join('\n\n');

  return [
    `FusionPCR Studio protocol for ${design.project.name}`,
    '',
    `Design mode: ${design.project.mode}`,
    `Polymerase profile: ${design.profile.label}`,
    `Design quality score: ${design.qualityScore.toFixed(3)}`,
    `Monovalent ions: ${design.project.reactionConditions.monovalentMillimolar} mM`,
    `Magnesium: ${design.project.reactionConditions.magnesiumMillimolar} mM`,
    `dNTP total: ${design.project.reactionConditions.dntpMillimolar} mM`,
    `Oligo concentration: ${design.project.reactionConditions.oligoNanomolar} nM`,
    `DMSO: ${design.project.reactionConditions.dmsoPercent}% at ${design.project.reactionConditions.dmsoFactor} C/%`,
    `Target product length: ${design.finalProduct.length} bp`,
    `Exact fusion verified: ${design.finalProductVerified ? 'yes' : 'no'}`,
    '',
    'Quality breakdown',
    `- Tm balance: ${design.qualityBreakdown.tmBalance.toFixed(3)}`,
    `- Body fit: ${design.qualityBreakdown.bodyFit.toFixed(3)}`,
    `- Overlap: ${design.qualityBreakdown.overlap.toFixed(3)}`,
    `- Structure: ${design.qualityBreakdown.structure.toFixed(3)}`,
    `- Specificity: ${design.qualityBreakdown.specificity.toFixed(3)}`,
    `- Synthesis: ${design.qualityBreakdown.synthesis.toFixed(3)}`,
    '',
    'Primers',
    ...design.primers.map(
      (primer) =>
        `- ${primer.name}: ${primer.sequence} (tail ${primer.tail || 'none'}, body ${primer.body}, body Tm ${primer.bodyTm.toFixed(1)} C, full Tm ${primer.fullOligoTm.toFixed(1)} C, overlap Tm ${primer.overlapTm !== null ? primer.overlapTm.toFixed(1) : 'n/a'} C, GC ${primer.bodyGcPercentage.toFixed(1)}%)`,
    ),
    '',
    'Secondary structure',
    ...design.primers.map(
      (primer) =>
        `- ${primer.name}: hairpin ${primer.structure.hairpin ? `${primer.structure.hairpin.deltaG} kcal/mol / Tm ${primer.structure.hairpin.predictedTm} C` : 'none'}, homodimer ${primer.structure.homodimer ? `${primer.structure.homodimer.deltaG} kcal/mol` : 'none'}, 3 prime homodimer ${primer.structure.threePrimeHomodimer ? `${primer.structure.threePrimeHomodimer.deltaG} kcal/mol` : 'none'}`,
    ),
    ...design.primerPairInteractions.map(
      (pair) =>
        `- ${pair.primerAName}/${pair.primerBName}: ${pair.interaction ? `${pair.interaction.deltaG} kcal/mol, ${pair.interaction.risk}, 3 prime ${Math.max(pair.interaction.threePrimePairedBasesA, pair.interaction.threePrimePairedBasesB)}` : 'none'}${pair.intended ? ' (intended overlap pair)' : ''}`,
    ),
    '',
    'PCR stages',
    reactionBlocks,
    '',
    'Protocol planning',
    ...design.protocolPlan.stageMixEntries.map(
      (entry) =>
        `- ${entry.label}: ${entry.targetPmol.toFixed(3)} pmol, ${entry.requiredMassNg.toFixed(2)} ng, ${entry.requiredVolumeUl.toFixed(2)} uL at ${entry.concentrationNgPerUl} ng/uL`,
    ),
    `- Working primer stock: ${design.protocolPlan.workingStockStockVolumeUl.toFixed(2)} uL stock + ${design.protocolPlan.workingStockDiluentVolumeUl.toFixed(2)} uL diluent`,
    ...design.protocolPlan.primerUsage.map(
      (entry) =>
        `- ${entry.primerName}: ${entry.totalWorkingVolumeUl.toFixed(2)} uL working stock across ${entry.reactionsUsingPrimer} reactions`,
    ),
    ...design.protocolPlan.reactionMixes.map(
      (mix) =>
        `- ${mix.name}: ${mix.totalMasterMixVolumeUl.toFixed(2)} uL master mix, ${mix.cycleCount} cycles, ${mix.overfilledReactionCount.toFixed(2)} effective reactions`,
    ),
    '',
    'Reaction recipes',
    ...design.protocolPlan.reactionRecipes.flatMap((recipe) => [
      `- ${recipe.name}:`,
      ...recipe.entries.map(
        (entry) =>
          `  ${entry.label}: ${entry.perReactionVolumeUl.toFixed(2)} uL/reaction, ${entry.totalVolumeUl.toFixed(2)} uL total${entry.note ? ` (${entry.note})` : ''}`,
      ),
      ...(recipe.note ? [`  Note: ${recipe.note}`] : []),
    ]),
    '',
    'Stage products',
    `PCR 1A product: ${design.stageAProduct.length} bp`,
    `PCR 1B product: ${design.stageBProduct.length} bp`,
    `Final product: ${design.finalProduct.length} bp`,
    '',
    'Local specificity',
    ...(design.offTargetAmplicons.length
      ? design.offTargetAmplicons.slice(0, 12).map(
          (amplicon) =>
            `- ${amplicon.templateName}: ${amplicon.forwardPrimerName}/${amplicon.reversePrimerName} -> ${amplicon.length} bp (${amplicon.risk})`,
        )
      : ['- No unintended amplicons detected by the current local scan.']),
    ...(design.proteinValidation
      ? [
          '',
          'Protein translation',
          `Frame check: ${design.proteinValidation.frameMessage}`,
          `Fused amino acids: ${design.proteinValidation.finalTranslation || 'none'}`,
          `Junction window: ${design.proteinValidation.junctionAminoAcids || 'none'}`,
          ...(design.sequenceChangeProposals.length
            ? [
                'Sequence change approvals:',
                ...design.sequenceChangeProposals.map(
                  (proposal) =>
                    `- ${proposal.label}: ${proposal.fragment} ${proposal.start}-${proposal.end}, ${proposal.from || 'none'} -> ${proposal.to || 'delete'}, ${proposal.approved ? 'approved' : 'pending'}`,
                ),
              ]
            : []),
          ...(design.proteinValidation.synonymousOptimization
            ? [
                `Synonymous optimization: ${design.proteinValidation.synonymousOptimization.summary}`,
                ...design.proteinValidation.synonymousOptimization.changes.map(
                  (change) =>
                    `- ${change.fragment} codon ${change.codonIndex + 1} at base ${change.start}: ${change.from} -> ${change.to} (${change.aminoAcid}, ${change.accepted ? 'approved' : 'pending'})`,
                ),
              ]
            : []),
        ]
      : []),
    '',
    'Warnings',
    ...(design.warnings.length ? design.warnings.map((warning) => `- ${warning}`) : ['- None']),
  ].join('\n');
}

export function buildPipettingTableCsv(design: FusionDesign): string {
  const rows = [
    ['section', 'reaction', 'role', 'item', 'per_reaction_ul', 'total_ul', 'note'].join(','),
    ...design.protocolPlan.stageMixEntries.map((entry) =>
      [
        csvEscape('stage-mix'),
        csvEscape('Fusion PCR'),
        csvEscape('template'),
        csvEscape(entry.label),
        '',
        entry.requiredVolumeUl.toFixed(2),
        csvEscape(`${entry.targetPmol.toFixed(3)} pmol target from ${entry.productLengthBp} bp product at ${entry.concentrationNgPerUl} ng/uL`),
      ].join(','),
    ),
    ...design.protocolPlan.primerUsage.map((entry) =>
      [
        csvEscape('working-stock'),
        csvEscape('All reactions'),
        csvEscape('primer'),
        csvEscape(entry.primerName),
        entry.perReactionVolumeUl.toFixed(2),
        entry.totalWorkingVolumeUl.toFixed(2),
        csvEscape(`${entry.reactionsUsingPrimer} reaction(s)`),
      ].join(','),
    ),
    ...design.protocolPlan.reactionRecipes.flatMap((recipe) =>
      recipe.entries.map((entry) =>
        [
          csvEscape('reaction-recipe'),
          csvEscape(recipe.name),
          csvEscape(entry.role),
          csvEscape(entry.label),
          entry.perReactionVolumeUl.toFixed(2),
          entry.totalVolumeUl.toFixed(2),
          csvEscape(entry.note ?? recipe.note ?? ''),
        ].join(','),
      ),
    ),
  ];

  return rows.join('\n');
}

export function buildThermocyclerProgram(design: FusionDesign): string {
  return [
    `FusionPCR Studio thermocycler program for ${design.project.name}`,
    '',
    `Polymerase profile: ${design.profile.label}`,
    'Current release note: denaturation and final-extension steps use the app default high-fidelity PCR program, while annealing and extension durations are design-specific.',
    '',
    ...(['PCR 1A', 'PCR 1B', 'Fusion PCR'] as const).flatMap((name) => [...buildThermocyclerBlock(design, name), '']),
  ]
    .join('\n')
    .trim();
}

export function buildJunctionReport(design: FusionDesign): string {
  const summary = buildJunctionSummary(design);
  const innerReverse = findPrimer(design, 'A_inner_R');
  const innerForward = findPrimer(design, 'B_inner_F');
  const overlapTm = innerReverse?.overlapTm ?? innerForward?.overlapTm ?? null;

  return [
    `FusionPCR Studio junction report for ${design.project.name}`,
    '',
    `Mode: ${design.project.mode}`,
    `Upstream fragment: ${design.project.fragmentA.label} (${design.project.fragmentA.start}-${design.project.fragmentA.end})`,
    `Downstream fragment: ${design.project.fragmentB.label} (${design.project.fragmentB.start}-${design.project.fragmentB.end})`,
    `Inserted sequence length: ${design.insertSequence.length} bp`,
    '',
    'Junction anatomy',
    `Upstream flank: ${summary.upstreamFlank || 'n/a'}`,
    `Inserted sequence: ${summary.insertSequence || 'direct join'}`,
    `Downstream flank: ${summary.downstreamFlank || 'n/a'}`,
    `Final junction: ${summary.finalJunction || design.finalProduct}`,
    '',
    'Primer contributions',
    `A inner R body: ${summary.upstreamAnnealRegion || 'n/a'}`,
    `A inner R tail contribution: ${summary.aInnerTailContribution || 'none'}`,
    `B inner F body: ${summary.downstreamAnnealRegion || 'n/a'}`,
    `B inner F tail contribution: ${summary.bInnerTailContribution || 'none'}`,
    `Overlap sequence: ${design.overlapSequence || 'n/a'}`,
    `Overlap length: ${design.overlapSequence.length} bp`,
    `Overlap Tm: ${overlapTm !== null ? `${overlapTm.toFixed(1)} C` : 'n/a'}`,
    ...(design.proteinValidation
      ? [
          '',
          'Protein context',
          `Frame check: ${design.proteinValidation.frameMessage}`,
          `Junction amino acids: ${design.proteinValidation.junctionAminoAcids || 'none'}`,
          `Linker amino acids: ${design.proteinValidation.linkerAminoAcids || 'none'}`,
        ]
      : []),
    '',
    'Warnings',
    ...describeDesignWarnings(design).map((warning) => `- ${warning}`),
  ].join('\n');
}

export function buildValidationReport(design: FusionDesign): string {
  const summary = buildValidationSummary(design);

  return [
    `FusionPCR Studio validation report for ${design.project.name}`,
    '',
    `Design mode: ${design.project.mode}`,
    `Exact fusion verified: ${summary.exactFusionVerified ? 'yes' : 'no'}`,
    `Requested target length: ${summary.targetLengthBp} bp`,
    `Simulated final length: ${summary.finalProductLengthBp} bp`,
    `Target checksum: ${summary.targetChecksum}`,
    `Final checksum: ${summary.finalChecksum}`,
    '',
    'Intermediate products',
    `PCR 1A: ${design.stageAProduct.length} bp`,
    `PCR 1B: ${design.stageBProduct.length} bp`,
    `Fusion PCR: ${design.finalProduct.length} bp`,
    '',
    'Quality score',
    `Overall: ${design.qualityScore.toFixed(3)}`,
    `Tm balance: ${design.qualityBreakdown.tmBalance.toFixed(3)}`,
    `Body fit: ${design.qualityBreakdown.bodyFit.toFixed(3)}`,
    `Overlap: ${design.qualityBreakdown.overlap.toFixed(3)}`,
    `Structure: ${design.qualityBreakdown.structure.toFixed(3)}`,
    `Specificity: ${design.qualityBreakdown.specificity.toFixed(3)}`,
    `Synthesis: ${design.qualityBreakdown.synthesis.toFixed(3)}`,
    '',
    'Specificity and interaction review',
    `Local off-target amplicons: ${summary.localOffTargetAmplicons}`,
    `High-risk primer specificity sites: ${summary.highRiskSpecificitySites}`,
    `Watch primer specificity sites: ${summary.watchSpecificitySites}`,
    `High-risk primer pair interactions: ${summary.highRiskPrimerPairInteractions}`,
    '',
    ...(design.proteinValidation
      ? [
          'Protein validation',
          `Frame preserved: ${design.proteinValidation.framePreserved ? 'yes' : 'no'}`,
          `Protein length: ${design.proteinValidation.proteinLength} aa`,
          `Fused translation: ${design.proteinValidation.finalTranslation || 'none'}`,
          `Junction amino-acid window: ${design.proteinValidation.junctionAminoAcids || 'none'}`,
          '',
        ]
      : []),
    'Sequence change approvals',
    ...(design.sequenceChangeProposals.length
      ? design.sequenceChangeProposals.map(
          (proposal) =>
            `- ${proposal.label}: ${proposal.from || 'none'} -> ${proposal.to || 'delete'} (${proposal.approved ? 'approved' : 'pending'})`,
        )
      : ['- No explicit sequence-change approvals are attached to this design.']),
    '',
    'Blocking issues',
    ...(design.issues.length ? design.issues.map((issue) => `- ${issue}`) : ['- None']),
    '',
    'Warnings',
    ...describeDesignWarnings(design).map((warning) => `- ${warning}`),
  ].join('\n');
}

export function buildExpectedGelDiagram(design: FusionDesign): string {
  const maxLength = Math.max(design.stageAProduct.length, design.stageBProduct.length, design.finalProduct.length, 100);

  return [
    `FusionPCR Studio expected gel diagram for ${design.project.name}`,
    '',
    'Relative migration sketch; not to scale.',
    `Recommended ladder coverage: 100 bp to ${Math.ceil(maxLength / 100) * 100} bp.`,
    '',
    buildGelLane('Lane M ladder', 100, maxLength),
    buildGelLane('Lane 1 PCR 1A', design.stageAProduct.length, maxLength),
    buildGelLane('Lane 2 PCR 1B', design.stageBProduct.length, maxLength),
    buildGelLane('Lane 3 Fusion', design.finalProduct.length, maxLength),
    buildGelLane('Lane 4 Verify', design.finalProduct.length, maxLength),
    '',
    'Expected interpretation: each reaction lane should be dominated by a single band at the listed product size.',
  ].join('\n');
}

export function buildCalculationManifest(design: FusionDesign): string {
  const manifest = {
    exportedAt: new Date().toISOString(),
    schemaVersion: design.project.schemaVersion,
    engineVersion: design.project.engineVersion,
    project: {
      name: design.project.name,
      mode: design.project.mode,
      createdAt: design.project.createdAt,
      modifiedAt: design.project.modifiedAt,
      notes: design.project.notes,
      polymeraseProfile: design.profile,
    },
    sequenceSelection: {
      fragmentA: {
        label: design.project.fragmentA.label,
        selectedCoordinates: [design.project.fragmentA.start, design.project.fragmentA.end],
        importedName: design.project.fragmentA.importedName,
        checksum: design.project.fragmentA.checksum,
      },
      fragmentB: {
        label: design.project.fragmentB.label,
        selectedCoordinates: [design.project.fragmentB.start, design.project.fragmentB.end],
        importedName: design.project.fragmentB.importedName,
        checksum: design.project.fragmentB.checksum,
      },
      insertSequenceLengthBp: design.insertSequence.length,
      targetSequenceChecksum: checksumSequence(design.targetSequence),
      finalSequenceChecksum: checksumSequence(design.finalProduct),
    },
    methods: {
      tmModel: 'Nearest-neighbour DNA duplex model with the application thermodynamic conditions and DMSO adjustment settings.',
      primerStructureModel: 'Local hairpin, homodimer, heterodimer, and 3-prime dimer analysis from src/utils/structure.ts.',
      specificityModel: 'Local imported-template scan plus stage-product/final-product contextual screening from src/utils/specificity.ts.',
      optimizer: 'Bounded whole-design candidate enumeration and score ranking from src/utils/fusion.ts.',
      protocolPlanner: 'Profile-driven reaction mix and stage-planning logic from src/utils/protocol.ts.',
      genbankAnnotationPolicy:
        'Selected source features are mapped only when the imported location is a simple in-range interval and the selected span length is preserved in the final construct.',
    },
    reactionConditions: design.project.reactionConditions,
    protocolSettings: design.project.protocolSettings,
    validation: buildValidationSummary(design),
    quality: {
      score: design.qualityScore,
      breakdown: design.qualityBreakdown,
    },
    primers: design.primers.map((primer) => ({
      name: primer.name,
      reaction: primer.reaction,
      direction: primer.direction,
      sequence: primer.sequence,
      tail: primer.tail,
      body: primer.body,
      bodyLength: primer.bodyLength,
      bodyTmC: primer.bodyTm,
      fullOligoTmC: primer.fullOligoTm,
      overlapTmC: primer.overlapTm,
      bodyGcPercent: primer.bodyGcPercentage,
      structureRisk: primer.structure.risk,
      specificitySites: primer.specificitySites.length,
    })),
    reactions: design.reactions,
    protocolPlan: design.protocolPlan,
    warnings: design.warnings,
    issues: design.issues,
  };

  return JSON.stringify(manifest, null, 2);
}
