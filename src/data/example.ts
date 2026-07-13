import type { FusionProjectInput } from '../utils/fusion';
import {
  checksumSequence,
  createEmptyFragment,
  defaultChangeApprovals,
  defaultCodingIntent,
  defaultEditorLockConfig,
  defaultGenomicSpecificitySettings,
  defaultProtocolConfig,
  defaultReactionConditions,
  ENGINE_VERSION,
  PROJECT_SCHEMA_VERSION,
} from '../utils/fusion';
import { stampProjectMetadata } from '../utils/project';

const now = new Date().toISOString();
const fragmentASequence = 'ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG';
const fragmentBSequence = 'GGCAGCGGCGGATCCGATGGTGAGCAAGGGCGAGGAGCTG';
const proteinFragmentASequence = 'GCGCCGACCGGTGCCGGGACCCAGCCAGTTGCGGTGGATAAT';
const proteinFragmentBSequence = 'CCGGCGGTAACAGTACAAGGTCCGGCCACTGGTGGTTCGCCT';
const mutationTemplateSequence = 'GCCGCTGAAAGGGTGCCCGATAGATGGCCATTGTAATGGGCC';

export type ExampleProjectId =
  'exact-fusion' | 'protein-fusion' | 'insertion' | 'mutation';

export type ExampleProjectOption = {
  id: ExampleProjectId;
  label: string;
  description: string;
};

function buildFragment(
  label: string,
  sequence: string,
  start = 1,
  end = sequence.length,
  importedName = label,
): FusionProjectInput['fragmentA'] {
  return {
    label,
    sequence,
    start,
    end,
    topology: 'linear',
    sourceFormat: 'plain',
    importedName,
    checksum: checksumSequence(sequence),
    ambiguousBases: [],
    features: [],
    reverseComplemented: false,
  };
}

function buildBaseProject(): Omit<
  FusionProjectInput,
  | 'name'
  | 'polymeraseId'
  | 'mode'
  | 'insertSequence'
  | 'notes'
  | 'fragmentA'
  | 'fragmentB'
> {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    revision: 1,
    projectHash: '',
    coding: defaultCodingIntent(),
    reactionConditions: defaultReactionConditions(),
    protocolSettings: defaultProtocolConfig(),
    editorLocks: defaultEditorLockConfig(),
    changeApprovals: defaultChangeApprovals(),
    genomicSpecificity: defaultGenomicSpecificitySettings(),
    createdAt: now,
    modifiedAt: now,
  };
}

const exactFusionExample = stampProjectMetadata({
  ...buildBaseProject(),
  name: 'Exact fusion example',
  polymeraseId: 'q5',
  mode: 'exact',
  insertSequence: '',
  notes: 'Directly fuse two fragment selections without inserting extra bases.',
  fragmentA: buildFragment('Fragment A', fragmentASequence),
  fragmentB: buildFragment('Fragment B', fragmentBSequence),
});

const proteinFusionExample = stampProjectMetadata({
  ...buildBaseProject(),
  name: 'Protein fusion demo',
  polymeraseId: 'q5',
  mode: 'protein-fusion',
  insertSequence: 'GGTGGTAGC',
  notes:
    'Fuse two coding fragments with a short glycine-rich linker while preserving the reading frame.',
  coding: {
    ...defaultCodingIntent(),
    linkerRequired: true,
    preserveProtein: false,
    flexibleCodons: 0,
    retainUpstreamStop: true,
    retainDownstreamStart: true,
  },
  genomicSpecificity: {
    ...defaultGenomicSpecificitySettings(),
    organism: 'Homo sapiens',
    notes:
      'Use the Primer-BLAST handoff export if an external genomic specificity screen is required.',
  },
  fragmentA: buildFragment('Upstream CDS', proteinFragmentASequence),
  fragmentB: buildFragment('Downstream CDS', proteinFragmentBSequence),
});

const insertionExample = stampProjectMetadata({
  ...buildBaseProject(),
  name: 'Insertion example',
  polymeraseId: 'phusion_plus',
  mode: 'insertion',
  insertSequence: 'GACTACAAAGACGATGACGACAAG',
  notes:
    'Insert a short coding tag between retained left and right flanks from one source sequence.',
  reactionConditions: {
    ...defaultReactionConditions(),
    dmsoPercent: 3,
  },
  fragmentA: buildFragment(
    'Left flank',
    fragmentASequence,
    1,
    24,
    'Recipient template',
  ),
  fragmentB: buildFragment(
    'Right flank',
    fragmentASequence,
    25,
    39,
    'Recipient template',
  ),
});

const mutationExample = stampProjectMetadata({
  ...buildBaseProject(),
  name: 'Substitution example',
  polymeraseId: 'q5',
  mode: 'substitution',
  insertSequence: 'GACGAC',
  notes:
    'Represent a short substitution as left flank plus replacement payload plus right flank.',
  fragmentA: buildFragment(
    'Left flank',
    mutationTemplateSequence,
    1,
    21,
    'Mutated template',
  ),
  fragmentB: buildFragment(
    'Right flank',
    mutationTemplateSequence,
    28,
    mutationTemplateSequence.length,
    'Mutated template',
  ),
});

export const exampleProjects: Record<ExampleProjectId, FusionProjectInput> = {
  'exact-fusion': exactFusionExample,
  'protein-fusion': proteinFusionExample,
  insertion: insertionExample,
  mutation: mutationExample,
};

export const exampleProjectOptions: ExampleProjectOption[] = [
  {
    id: 'protein-fusion',
    label: 'Protein fusion',
    description:
      'Coding-fragment fusion with a glycine-serine linker and frame-aware review.',
  },
  {
    id: 'exact-fusion',
    label: 'Exact fusion',
    description:
      'Direct two-fragment OE-PCR assembly without inserted sequence.',
  },
  {
    id: 'insertion',
    label: 'Insertion',
    description: 'Left and right flanks plus an inserted payload sequence.',
  },
  {
    id: 'mutation',
    label: 'Substitution',
    description:
      'Left and right flanks separated by a short replacement payload.',
  },
];

export const exampleProject = exampleProjects['protein-fusion'];

export const emptyProject: FusionProjectInput = stampProjectMetadata({
  schemaVersion: PROJECT_SCHEMA_VERSION,
  engineVersion: ENGINE_VERSION,
  revision: 1,
  projectHash: '',
  name: 'Untitled project',
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
  fragmentA: createEmptyFragment('Fragment A'),
  fragmentB: createEmptyFragment('Fragment B'),
  createdAt: now,
  modifiedAt: now,
});
