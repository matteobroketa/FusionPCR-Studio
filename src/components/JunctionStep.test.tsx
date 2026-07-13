import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JunctionStep } from './JunctionStep';
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
  type FusionDesign,
} from '../utils/fusion';
import type { CanvasTracks } from '../hooks/useProjectController';

function makeFragment(
  label: string,
  sequence: string,
  start = 1,
  end = sequence.length,
  topology: FragmentInput['topology'] = 'linear',
): FragmentInput {
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

function buildDesign(overrides: Partial<Parameters<typeof buildFusionDesign>[0]> = {}): FusionDesign {
  return buildFusionDesign({
    schemaVersion: PROJECT_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    revision: 1,
    projectHash: 'junction-rendering-test',
    createdAt: '2026-07-13T00:00:00.000Z',
    modifiedAt: '2026-07-13T00:00:00.000Z',
    name: 'Junction rendering test',
    polymeraseId: 'q5',
    mode: 'exact',
    insertSequence: '',
    notes: '',
    coding: defaultCodingIntent(),
    reactionConditions: defaultReactionConditions(),
    protocolSettings: defaultProtocolConfig(),
    editorLocks: defaultEditorLockConfig(),
    changeApprovals: defaultChangeApprovals(),
    genomicSpecificity: defaultGenomicSpecificitySettings(),
    fragmentA: makeFragment('Fragment A', 'ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG'),
    fragmentB: makeFragment('Fragment B', 'GGCAGCGGCGGATCCGATGGTGAGCAAGGGCGAGGAGCTG'),
    ...overrides,
  });
}

const defaultCanvasTracks: CanvasTracks = {
  sourceFragments: true,
  finalConstruct: true,
  primerOverlays: true,
  gcAndTm: true,
  stageProducts: true,
  translation: true,
  features: true,
  riskSummary: true,
};

function renderJunctionStep(design: FusionDesign) {
  render(
    <JunctionStep
      design={design}
      projectNameA={design.project.fragmentA.label}
      projectNameB={design.project.fragmentB.label}
      fragmentALength={design.project.fragmentA.sequence.length}
      fragmentBLength={design.project.fragmentB.sequence.length}
      selectedStageLabel="Overview"
      canvasTracks={defaultCanvasTracks}
      inspectorFocus="junction"
      visiblePrimers={design.primers}
      selectedPrimerName={design.primers[0]?.name ?? null}
      stageSequencePreviews={[]}
      comparisonSnapshot={null}
      compareRows={[]}
      onInspectorFocusChange={vi.fn()}
      onSelectPrimer={vi.fn()}
      onShowInspector={vi.fn()}
      onToggleCanvasTrack={vi.fn()}
      onCaptureComparisonSnapshot={vi.fn()}
      onClearComparisonSnapshot={vi.fn()}
    />,
  );
}

describe('JunctionStep construct rendering', () => {
  it('renders an exact fusion without an inserted centre block and shows the overlap separately', () => {
    const design = buildDesign({
      polymeraseId: 'phusion_plus',
      insertSequence: '',
      fragmentA: makeFragment('Fragment A', 'ATGACTGACCGTACGTTAGGCTAACCG'),
      fragmentB: makeFragment('Fragment B', 'GGCAGTACCTTAGCGATCGTACCATGG'),
    });

    const wrongDisplayedLength = design.selectedA.length + design.selectedB.length + design.overlapSequence.length;

    renderJunctionStep(design);

    expect(screen.queryByRole('button', { name: /Inserted sequence block at the junction/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(`Overlap span at the junction, ${design.overlapSequence.length} base pair overlap`) })).toBeVisible();
    expect(screen.getByText(`Target construct ${design.targetSequence.length} bp`)).toBeVisible();
    expect(screen.queryByText(`Target construct ${wrongDisplayedLength} bp`)).not.toBeInTheDocument();
  });

  it('renders a linker fusion with a real centre insert block while preserving target-length accounting', () => {
    const design = buildDesign({
      mode: 'protein-fusion',
      insertSequence: 'GGTGGTGGTGGTTCT',
      fragmentA: makeFragment('Fragment A', 'ATGGCCGAACTGAAACCCGGGTTTTAA'),
      fragmentB: makeFragment('Fragment B', 'ATGGGCTCCGACTGAGGCGGCGGCGGC'),
    });

    renderJunctionStep(design);

    expect(screen.getByRole('button', { name: /Inserted sequence block at the junction, 15 base pairs/i })).toBeVisible();
    expect(screen.getByRole('button', { name: new RegExp(`Overlap span at the junction, ${design.overlapSequence.length} base pair overlap`) })).toBeVisible();
    expect(screen.getByText(`Target construct ${design.targetSequence.length} bp`)).toBeVisible();
    expect(screen.getByText(`Inserted sequence ${design.insertSequence.length} bp`)).toBeVisible();
  });
});
