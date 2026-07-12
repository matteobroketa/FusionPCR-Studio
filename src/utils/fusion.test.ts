import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildFusionDesign,
  checksumSequence,
  defaultChangeApprovals,
  defaultCodingIntent,
  defaultEditorLockConfig,
  defaultGenomicSpecificitySettings,
  defaultProtocolConfig,
  defaultReactionConditions,
  ENGINE_VERSION,
  PROJECT_SCHEMA_VERSION,
  type FragmentInput,
} from './fusion';
import { translateSequence } from './translation';

type ProductReconstructionFixture = {
  cases: Array<{
    name: string;
    polymeraseId: 'q5' | 'phusion_plus';
    insertSequence: string;
    fragmentA: {
      label: string;
      sequence: string;
      start: number;
      end: number;
      topology: FragmentInput['topology'];
    };
    fragmentB: {
      label: string;
      sequence: string;
      start: number;
      end: number;
      topology: FragmentInput['topology'];
    };
    expected: {
      selectedA: string;
      selectedB: string;
      finalProduct: string;
    };
  }>;
};

const productReconstructionFixtures = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'test-data/reference/product-reconstruction.json'), 'utf8'),
) as ProductReconstructionFixture;

function makeFragment(label: string, sequence: string, start = 1, end = sequence.length, topology: FragmentInput['topology'] = 'linear'): FragmentInput {
  return {
    label,
    sequence,
    start,
    end,
    topology,
    sourceFormat: 'plain',
    importedName: label,
    checksum: checksumSequence(sequence),
    ambiguousBases: [],
    features: [],
    reverseComplemented: false,
  };
}

const baseProject = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  engineVersion: ENGINE_VERSION,
  createdAt: '2026-07-11T00:00:00.000Z',
  modifiedAt: '2026-07-11T00:00:00.000Z',
  mode: 'exact' as const,
  coding: defaultCodingIntent(),
  reactionConditions: defaultReactionConditions(),
  protocolSettings: defaultProtocolConfig(),
  editorLocks: defaultEditorLockConfig(),
  changeApprovals: defaultChangeApprovals(),
  genomicSpecificity: defaultGenomicSpecificitySettings(),
};

describe('fusion design engine', () => {
  it('designs four primers and reconstructs the requested final product', () => {
    const design = buildFusionDesign({
      ...baseProject,
      name: 'Test fusion',
      polymeraseId: 'q5',
      insertSequence: 'GGTGGTGGTGGTTCT',
      notes: '',
      fragmentA: makeFragment('A', 'ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG'),
      fragmentB: makeFragment('B', 'GGCAGCGGCGGATCCGATGGTGAGCAAGGGCGAGGAGCTG'),
    });

    expect(design.issues).toEqual([]);
    expect(design.primers).toHaveLength(4);
    expect(design.stageAProduct.endsWith(design.overlapSequence)).toBe(true);
    expect(design.stageBProduct.startsWith(design.overlapSequence)).toBe(true);
    expect(design.finalProductVerified).toBe(true);
    expect(design.finalProduct).toBe(`${design.selectedA}${design.insertSequence}${design.selectedB}`);
    expect(design.reactions).toHaveLength(3);
    expect(design.primerPairInteractions.some((pair) => pair.intended)).toBe(true);
    expect(design.qualityScore).toBeGreaterThan(0);
    expect(design.alternativeDesigns.length).toBeGreaterThan(0);
  });

  it('supports exact fusion without an inserted linker', () => {
    const design = buildFusionDesign({
      ...baseProject,
      name: 'Exact fusion',
      polymeraseId: 'phusion_plus',
      insertSequence: '',
      notes: '',
      fragmentA: makeFragment('A', 'ATGACTGACCGTACGTTAGGCTAACCG'),
      fragmentB: makeFragment('B', 'GGCAGTACCTTAGCGATCGTACCATGG'),
    });

    expect(design.finalProductVerified).toBe(true);
    expect(design.insertSequence).toBe('');
    expect(design.overlapSequence.length).toBeGreaterThan(0);
  });

  it('supports circular wraparound source selections that cross the origin', () => {
    const design = buildFusionDesign({
      ...baseProject,
      name: 'Circular wrap fusion',
      polymeraseId: 'q5',
      insertSequence: 'TTAA',
      notes: '',
      fragmentA: makeFragment('Circular A', 'ATGCCGTTAACCGGTTACCGGATGCCGTTA', 13, 6, 'circular'),
      fragmentB: makeFragment('Circular B', 'GGTACCATGGAACCGGTACCGGTACCATGG', 12, 5, 'circular'),
    });

    expect(design.issues).toEqual([]);
    expect(design.selectedA).toBe('GGTTACCGGATGCCGTTAATGCCG');
    expect(design.selectedB).toBe('ACCGGTACCGGTACCATGGGGTAC');
    expect(design.finalProduct).toBe('GGTTACCGGATGCCGTTAATGCCGTTAAACCGGTACCGGTACCATGGGGTAC');
    expect(design.finalProductVerified).toBe(true);
    expect(design.project.fragmentA.start).toBe(13);
    expect(design.project.fragmentA.end).toBe(6);
    expect(design.project.fragmentB.start).toBe(12);
    expect(design.project.fragmentB.end).toBe(5);
  });

  it('matches the product-reconstruction reference fixtures', () => {
    for (const fixture of productReconstructionFixtures.cases) {
      const design = buildFusionDesign({
        ...baseProject,
        name: fixture.name,
        polymeraseId: fixture.polymeraseId,
        insertSequence: fixture.insertSequence,
        notes: '',
        fragmentA: makeFragment(
          fixture.fragmentA.label,
          fixture.fragmentA.sequence,
          fixture.fragmentA.start,
          fixture.fragmentA.end,
          fixture.fragmentA.topology,
        ),
        fragmentB: makeFragment(
          fixture.fragmentB.label,
          fixture.fragmentB.sequence,
          fixture.fragmentB.start,
          fixture.fragmentB.end,
          fixture.fragmentB.topology,
        ),
      });

      expect(design.issues, fixture.name).toEqual([]);
      expect(design.selectedA, fixture.name).toBe(fixture.expected.selectedA);
      expect(design.selectedB, fixture.name).toBe(fixture.expected.selectedB);
      expect(design.finalProduct, fixture.name).toBe(fixture.expected.finalProduct);
      expect(design.finalProductVerified, fixture.name).toBe(true);
    }
  });

  it('reports invalid DNA input', () => {
    const design = buildFusionDesign({
      ...baseProject,
      name: 'Invalid project',
      polymeraseId: 'q5',
      insertSequence: '',
      notes: '',
      fragmentA: makeFragment('A', 'ATGB'),
      fragmentB: makeFragment('B', 'ATGC'),
    });

    expect(design.issues[0]).toContain('unsupported bases');
    expect(design.primers).toEqual([]);
  });

  it('blocks one-base and otherwise too-short fragments from generating primer sets or protocols', () => {
    const oneBaseDesign = buildFusionDesign({
      ...baseProject,
      name: 'One base fragment',
      polymeraseId: 'q5',
      insertSequence: '',
      notes: '',
      fragmentA: makeFragment('A', 'A'),
      fragmentB: makeFragment('B', 'GGCAGCGGCGGATCCGATGGTGAGCAAGGGCGAGGAGCTG'),
    });

    expect(oneBaseDesign.issues.some((issue) => issue.includes('minimum primer-body length'))).toBe(true);
    expect(oneBaseDesign.primers).toEqual([]);
    expect(oneBaseDesign.reactions).toEqual([]);
    expect(oneBaseDesign.protocolPlan.reactionRecipes).toEqual([]);

    const shortDesign = buildFusionDesign({
      ...baseProject,
      name: 'Too short fragment',
      polymeraseId: 'phusion_plus',
      insertSequence: '',
      notes: '',
      fragmentA: makeFragment('A', 'ATGACTGACCGTAAGT'),
      fragmentB: makeFragment('B', 'GGCAGCGGCGGATCCGATGGTGAGCAAGGGCGAGGAGCTG'),
    });

    expect(shortDesign.issues.some((issue) => issue.includes('minimum primer-body length'))).toBe(true);
    expect(shortDesign.protocolPlan.reactionRecipes).toEqual([]);
  });

  it('proposes start-stop codon removals and applies them only after approval', () => {
    const design = buildFusionDesign({
      ...baseProject,
      mode: 'protein-fusion',
      name: 'Protein fusion',
      polymeraseId: 'q5',
      insertSequence: 'GGTGGTGGT',
      notes: '',
      coding: {
        ...defaultCodingIntent(),
        retainUpstreamStop: false,
        retainDownstreamStart: false,
        linkerRequired: true,
      },
      fragmentA: makeFragment('A', 'ATGGCCGAACTGAAACCCGGGTTTTAA'),
      fragmentB: makeFragment('B', 'ATGGGCTCCGACTGAGGCGGCGGCGGC'),
    });

    expect(design.proteinValidation).not.toBeNull();
    expect(design.effectiveSelectedA.endsWith('TAA')).toBe(true);
    expect(design.effectiveSelectedB.startsWith('ATG')).toBe(true);
    expect(design.sequenceChangeProposals.map((proposal) => proposal.id)).toEqual(
      expect.arrayContaining(['remove-upstream-stop', 'remove-downstream-start']),
    );

    const approvedDesign = buildFusionDesign({
      ...baseProject,
      mode: 'protein-fusion',
      name: 'Protein fusion approved',
      polymeraseId: 'q5',
      insertSequence: 'GGTGGTGGT',
      notes: '',
      coding: {
        ...defaultCodingIntent(),
        retainUpstreamStop: false,
        retainDownstreamStart: false,
        linkerRequired: true,
      },
      changeApprovals: {
        ...defaultChangeApprovals(),
        removeUpstreamStop: true,
        removeDownstreamStart: true,
      },
      fragmentA: makeFragment('A', 'ATGGCCGAACTGAAACCCGGGTTTTAA'),
      fragmentB: makeFragment('B', 'ATGGGCTCCGACTGAGGCGGCGGCGGC'),
    });

    expect(approvedDesign.effectiveSelectedA.endsWith('TAA')).toBe(false);
    expect(approvedDesign.effectiveSelectedB.startsWith('ATG')).toBe(false);
    expect(approvedDesign.proteinValidation?.framePreserved).toBe(true);
    expect(approvedDesign.proteinValidation?.linkerAminoAcids).toBe('GGG');
  });

  it('warns on protein-fusion frame mismatch', () => {
    const design = buildFusionDesign({
      ...baseProject,
      mode: 'protein-fusion',
      name: 'Frameshift fusion',
      polymeraseId: 'q5',
      insertSequence: 'GG',
      notes: '',
      coding: defaultCodingIntent(),
      fragmentA: makeFragment('A', 'ATGGCCGAACTGAAACCCGGGTTTTAA'),
      fragmentB: makeFragment('B', 'ATGGGCTCCGACTGAGGCGGCGGCGGC'),
    });

    expect(design.proteinValidation?.framePreserved).toBe(false);
    expect(design.warnings.some((warning) => warning.includes('Frameshift'))).toBe(true);
  });

  it('can synonymously optimize the junction while preserving the encoded protein', () => {
    const design = buildFusionDesign({
      ...baseProject,
      mode: 'protein-fusion',
      name: 'Synonymous optimization',
      polymeraseId: 'q5',
      insertSequence: 'GGTGGT',
      notes: '',
      coding: {
        ...defaultCodingIntent(),
        preserveProtein: true,
        flexibleCodons: 3,
        retainUpstreamStop: true,
        retainDownstreamStart: true,
      },
      fragmentA: makeFragment('A', 'ATGGGTGGTGGTGGTGGTGCTGCTGCTGGT'),
      fragmentB: makeFragment('B', 'ATGGCTGCTGCTGGTGGTGGTGGTGCTGCT'),
    });

    expect(design.proteinValidation?.synonymousOptimization).not.toBeNull();
    expect(design.proteinValidation?.synonymousOptimization?.changes.length).toBeGreaterThanOrEqual(0);
    expect(design.effectiveSelectedA).toBe(design.selectedA);
    expect(design.effectiveSelectedB).toBe(design.selectedB);

    const acceptedChangeIds = design.proteinValidation?.synonymousOptimization?.changes.slice(0, 1).map((change) => change.id) ?? [];
    const approvedDesign = buildFusionDesign({
      ...baseProject,
      mode: 'protein-fusion',
      name: 'Synonymous optimization approved',
      polymeraseId: 'q5',
      insertSequence: 'GGTGGT',
      notes: '',
      coding: {
        ...defaultCodingIntent(),
        preserveProtein: true,
        flexibleCodons: 3,
        retainUpstreamStop: true,
        retainDownstreamStart: true,
      },
      changeApprovals: {
        ...defaultChangeApprovals(),
        acceptedSynonymousChanges: acceptedChangeIds,
      },
      fragmentA: makeFragment('A', 'ATGGGTGGTGGTGGTGGTGCTGCTGCTGGT'),
      fragmentB: makeFragment('B', 'ATGGCTGCTGCTGGTGGTGGTGGTGCTGCT'),
    });

    expect(approvedDesign.proteinValidation?.synonymousOptimization?.changes.some((change) => change.accepted)).toBe(acceptedChangeIds.length > 0);
    expect(translateSequence(approvedDesign.selectedA, 0).aminoAcids).toBe(translateSequence(approvedDesign.effectiveSelectedA, 0).aminoAcids);
    expect(translateSequence(approvedDesign.selectedB, 0).aminoAcids).toBe(translateSequence(approvedDesign.effectiveSelectedB, 0).aminoAcids);
  });

  it('separates intended amplicons from unintended specificity penalties', () => {
    const design = buildFusionDesign({
      ...baseProject,
      name: 'Specificity classification',
      polymeraseId: 'q5',
      insertSequence: 'GGTGGT',
      notes: '',
      fragmentA: makeFragment('A', 'ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG'),
      fragmentB: makeFragment('B', 'GGCAGCGGCGGATCCGATGGTGAGCAAGGGCGAGGAGCTG'),
    });

    expect(design.intendedAmplicons.length).toBeGreaterThan(0);
    expect(design.intendedAmplicons.some((amplicon) => amplicon.templateId === 'fragment-a')).toBe(true);
    expect(design.intendedAmplicons.some((amplicon) => amplicon.templateId === 'fragment-b')).toBe(true);
    expect(design.intendedAmplicons.some((amplicon) => amplicon.templateId === 'final-product')).toBe(true);
    expect(design.offTargetAmplicons.every((amplicon) => amplicon.templateId !== 'final-product' || amplicon.length !== design.finalProduct.length)).toBe(true);
  });
});
