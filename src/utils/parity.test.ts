import { spawnSync } from 'node:child_process';
import { buildFusionDesign, checksumSequence, defaultChangeApprovals, defaultCodingIntent, defaultEditorLockConfig, defaultGenomicSpecificitySettings, defaultProtocolConfig, defaultReactionConditions, ENGINE_VERSION, PROJECT_SCHEMA_VERSION, type FragmentInput } from './fusion';
import { calculateGcPercentage, normalizeSequence, reverseComplement } from './pcr';
import { massNgToPmol, pmolToMassNg, volumeForMass } from './protocol';

type ParityRequest =
  | { operation: 'parse-sequence'; input: string }
  | { operation: 'reverse-complement'; input: string }
  | { operation: 'gc-fraction'; input: string }
  | {
      operation: 'construct-target';
      project: {
        mode: 'exact' | 'protein-fusion' | 'insertion' | 'deletion' | 'substitution' | 'domain-swap';
        insert_sequence: string;
        coding: {
          upstream_frame: number;
          downstream_frame: number;
          retain_upstream_stop: boolean;
          retain_downstream_start: boolean;
        };
        change_approvals: {
          remove_upstream_stop: boolean;
          remove_downstream_start: boolean;
        };
        fragment_a: {
          label: string;
          sequence: string;
          start: number;
          end: number;
        };
        fragment_b: {
          label: string;
          sequence: string;
          start: number;
          end: number;
        };
      };
    }
  | {
      operation: 'protocol-conversions';
      pmol: number;
      length_bp: number;
      mass_ng: number;
      concentration_ng_per_ul: number;
    };

type ParityResponse =
  | {
      kind: 'parse-sequence';
      ok: boolean;
      normalized: string | null;
      reverse_complement: string | null;
      error: string | null;
    }
  | {
      kind: 'reverse-complement';
      sequence: string;
    }
  | {
      kind: 'gc-fraction';
      gc_fraction: number;
    }
  | {
      kind: 'construct-target';
      ok: boolean;
      selected_a: string | null;
      selected_b: string | null;
      effective_selected_a: string | null;
      effective_selected_b: string | null;
      insert_sequence: string | null;
      target_sequence: string | null;
      error: string | null;
    }
  | {
      kind: 'protocol-conversions';
      mass_ng: number;
      pmol: number;
      volume_ul: number;
    };

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

const PARITY_TIMEOUT_MS = 30_000;

function runRustParity(requests: ParityRequest[]): ParityResponse[] {
  const result = spawnSync('cargo', ['run', '--quiet', '-p', 'fusion-core', '--bin', 'parity-cli'], {
    cwd: process.cwd(),
    input: JSON.stringify({ requests }),
    encoding: 'utf8',
    timeout: 120000,
  });

  expect(result.status, result.stderr).toBe(0);
  return (JSON.parse(result.stdout) as { responses: ParityResponse[] }).responses;
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

describe('TypeScript and Rust engine parity', () => {
  it('matches sequence parsing, reverse-complement, and GC-fraction outputs', () => {
    const requests: ParityRequest[] = [
      { operation: 'parse-sequence', input: ' atg ccn ' },
      { operation: 'parse-sequence', input: 'ATGB' },
      { operation: 'parse-sequence', input: '' },
      { operation: 'reverse-complement', input: 'ATGCNN' },
      { operation: 'gc-fraction', input: 'ATGC' },
      { operation: 'gc-fraction', input: 'GGCCAA' },
    ];

    const [parsedValid, parsedInvalid, parsedEmpty, reverseComplementResponse, gcFirst, gcSecond] = runRustParity(requests);

    expect(parsedValid).toMatchObject({
      kind: 'parse-sequence',
      ok: true,
      normalized: normalizeSequence(' atg ccn '),
      reverse_complement: reverseComplement(' atg ccn '),
    });
    expect(parsedInvalid).toMatchObject({
      kind: 'parse-sequence',
      ok: false,
    });
    expect((parsedInvalid as Extract<ParityResponse, { kind: 'parse-sequence' }>).error).toContain('unsupported bases');
    expect(parsedEmpty).toMatchObject({
      kind: 'parse-sequence',
      ok: false,
    });
    expect((parsedEmpty as Extract<ParityResponse, { kind: 'parse-sequence' }>).error).toContain('sequence is empty');
    expect(reverseComplementResponse).toEqual({
      kind: 'reverse-complement',
      sequence: reverseComplement('ATGCNN'),
    });
    expect((gcFirst as Extract<ParityResponse, { kind: 'gc-fraction' }>).gc_fraction).toBeCloseTo(calculateGcPercentage('ATGC') / 100, 3);
    expect((gcSecond as Extract<ParityResponse, { kind: 'gc-fraction' }>).gc_fraction).toBeCloseTo(calculateGcPercentage('GGCCAA') / 100, 3);
  }, PARITY_TIMEOUT_MS);

  it('matches exact-fusion and approved protein-fusion target construction', () => {
    const exactProject = {
      mode: 'exact' as const,
      insert_sequence: 'GGTT',
      coding: {
        upstream_frame: 0,
        downstream_frame: 0,
        retain_upstream_stop: true,
        retain_downstream_start: true,
      },
      change_approvals: {
        remove_upstream_stop: false,
        remove_downstream_start: false,
      },
      fragment_a: {
        label: 'A',
        sequence: 'AACCGGTT',
        start: 1,
        end: 4,
      },
      fragment_b: {
        label: 'B',
        sequence: 'TTGGCCAA',
        start: 3,
        end: 8,
      },
    };

    const proteinProject = {
      mode: 'protein-fusion' as const,
      insert_sequence: 'GGTGGT',
      coding: {
        upstream_frame: 0,
        downstream_frame: 0,
        retain_upstream_stop: false,
        retain_downstream_start: false,
      },
      change_approvals: {
        remove_upstream_stop: true,
        remove_downstream_start: true,
      },
      fragment_a: {
        label: 'A',
        sequence: 'ATGGCCGAACTGTAA',
        start: 1,
        end: 15,
      },
      fragment_b: {
        label: 'B',
        sequence: 'ATGGGCTCCGACTGA',
        start: 1,
        end: 15,
      },
    };

    const [exactResponse, proteinResponse] = runRustParity([
      { operation: 'construct-target', project: exactProject },
      { operation: 'construct-target', project: proteinProject },
    ]);

    const exactTs = buildFusionDesign({
      ...baseProject,
      name: 'Exact parity',
      mode: 'exact',
      polymeraseId: 'q5',
      insertSequence: exactProject.insert_sequence,
      notes: '',
      coding: {
        ...defaultCodingIntent(),
        upstreamFrame: exactProject.coding.upstream_frame as 0 | 1 | 2,
        downstreamFrame: exactProject.coding.downstream_frame as 0 | 1 | 2,
        retainUpstreamStop: exactProject.coding.retain_upstream_stop,
        retainDownstreamStart: exactProject.coding.retain_downstream_start,
      },
      changeApprovals: {
        ...defaultChangeApprovals(),
        removeUpstreamStop: exactProject.change_approvals.remove_upstream_stop,
        removeDownstreamStart: exactProject.change_approvals.remove_downstream_start,
      },
      fragmentA: makeFragment('A', exactProject.fragment_a.sequence, exactProject.fragment_a.start, exactProject.fragment_a.end),
      fragmentB: makeFragment('B', exactProject.fragment_b.sequence, exactProject.fragment_b.start, exactProject.fragment_b.end),
    });

    const proteinTs = buildFusionDesign({
      ...baseProject,
      name: 'Protein parity',
      mode: 'protein-fusion',
      polymeraseId: 'q5',
      insertSequence: proteinProject.insert_sequence,
      notes: '',
      coding: {
        ...defaultCodingIntent(),
        upstreamFrame: proteinProject.coding.upstream_frame as 0 | 1 | 2,
        downstreamFrame: proteinProject.coding.downstream_frame as 0 | 1 | 2,
        retainUpstreamStop: proteinProject.coding.retain_upstream_stop,
        retainDownstreamStart: proteinProject.coding.retain_downstream_start,
      },
      changeApprovals: {
        ...defaultChangeApprovals(),
        removeUpstreamStop: proteinProject.change_approvals.remove_upstream_stop,
        removeDownstreamStart: proteinProject.change_approvals.remove_downstream_start,
      },
      fragmentA: makeFragment('A', proteinProject.fragment_a.sequence, proteinProject.fragment_a.start, proteinProject.fragment_a.end),
      fragmentB: makeFragment('B', proteinProject.fragment_b.sequence, proteinProject.fragment_b.start, proteinProject.fragment_b.end),
    });

    expect(exactResponse).toMatchObject({
      kind: 'construct-target',
      ok: true,
      selected_a: exactTs.selectedA,
      selected_b: exactTs.selectedB,
      effective_selected_a: exactTs.effectiveSelectedA,
      effective_selected_b: exactTs.effectiveSelectedB,
      insert_sequence: exactTs.insertSequence,
      target_sequence: exactTs.targetSequence,
    });

    expect(proteinResponse).toMatchObject({
      kind: 'construct-target',
      ok: true,
      selected_a: proteinTs.selectedA,
      selected_b: proteinTs.selectedB,
      effective_selected_a: proteinTs.effectiveSelectedA,
      effective_selected_b: proteinTs.effectiveSelectedB,
      insert_sequence: proteinTs.insertSequence,
      target_sequence: proteinTs.targetSequence,
    });
  }, PARITY_TIMEOUT_MS);

  it('matches protocol unit conversions', () => {
    const [response] = runRustParity([
      {
        operation: 'protocol-conversions',
        pmol: 0.05,
        length_bp: 500,
        mass_ng: 33.0,
        concentration_ng_per_ul: 11.0,
      },
    ]);

    expect((response as Extract<ParityResponse, { kind: 'protocol-conversions' }>).mass_ng).toBeCloseTo(pmolToMassNg(0.05, 500), 10);
    expect((response as Extract<ParityResponse, { kind: 'protocol-conversions' }>).pmol).toBeCloseTo(massNgToPmol(33.0, 500), 10);
    expect((response as Extract<ParityResponse, { kind: 'protocol-conversions' }>).volume_ul).toBeCloseTo(volumeForMass(33.0, 11.0), 10);
  }, PARITY_TIMEOUT_MS);
});
