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
import { buildJunctionSummary, getStagePrimerNames, getStageSequencePreviews, summarizeDesignComparison } from './review';

function makeFragment(label: string, sequence: string, start = 1, end = sequence.length): FragmentInput {
  return {
    label,
    sequence,
    start,
    end,
    topology: 'linear',
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

describe('review helpers', () => {
  const design = buildFusionDesign({
    ...baseProject,
    name: 'Review helper test',
    polymeraseId: 'q5',
    insertSequence: 'GGTGGT',
    notes: '',
    fragmentA: makeFragment('A', 'ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG'),
    fragmentB: makeFragment('B', 'GGCAGCGGCGGATCCGATGGTGAGCAAGGGCGAGGAGCTG'),
  });

  it('summarizes design comparison metrics', () => {
    const summary = summarizeDesignComparison(design);
    expect(summary.projectName).toBe('Review helper test');
    expect(summary.totalOligoLength).toBeGreaterThan(0);
    expect(summary.tmSpread).toBeGreaterThanOrEqual(0);
    expect(summary.finalProductLength).toBe(design.finalProduct.length);
  });

  it('returns stage-specific primer names and previews', () => {
    expect(getStagePrimerNames(design, 'pcr1a')).toEqual(['A_outer_F', 'A_inner_R']);
    expect(getStagePrimerNames(design, 'fusion')).toEqual(['A_outer_F', 'B_outer_R']);
    expect(getStageSequencePreviews(design, 'verification')).toHaveLength(2);
    expect(getStageSequencePreviews(design, 'verification')[0]?.label).toContain('Requested');
  });

  it('builds a junction-oriented summary', () => {
    const junction = buildJunctionSummary(design, 10);
    expect(junction.upstreamFlank).toHaveLength(10);
    expect(junction.downstreamFlank).toHaveLength(10);
    expect(junction.insertSequence).toBe('GGTGGT');
    expect(junction.finalJunction).toContain('GGTGGT');
    expect(junction.upstreamAnnealRegion.length).toBeGreaterThan(0);
    expect(junction.downstreamAnnealRegion.length).toBeGreaterThan(0);
  });
});
