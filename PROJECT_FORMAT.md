# Project Format

This document describes the saved project JSON used by FusionPCR Studio.

## Status

The current project schema version is `0.2.0`.
The engine version is also currently `0.2.0`.

Project JSON is exported directly from the in-memory `FusionProjectInput` model in `src/utils/fusion.ts`.

## Top-level object

```ts
type FusionProjectInput = {
  schemaVersion: string;
  engineVersion: string;
  name: string;
  polymeraseId: 'q5' | 'phusion_plus';
  mode: 'exact' | 'protein-fusion' | 'insertion' | 'deletion' | 'substitution' | 'domain-swap';
  insertSequence: string;
  notes: string;
  coding: CodingIntent;
  reactionConditions: ThermodynamicConditions;
  protocolSettings: ProtocolSettings;
  editorLocks: EditorLocks;
  changeApprovals: ChangeApprovals;
  genomicSpecificity: GenomicSpecificitySettings;
  fragmentA: FragmentInput;
  fragmentB: FragmentInput;
  createdAt: string;
  modifiedAt: string;
};
```

## Fragment model

Each fragment uses the current `FragmentInput` structure:

```ts
type FragmentInput = {
  label: string;
  sequence: string;
  start: number;
  end: number;
  topology: 'linear' | 'circular';
  sourceFormat: 'manual' | 'plain' | 'fasta' | 'genbank' | 'project';
  importedName: string;
  checksum: string;
  ambiguousBases: string[];
  features: SequenceFeature[];
  reverseComplemented: boolean;
};
```

Notes:

- `sequence` is stored as DNA text and normalized during design-time processing.
- `start` and `end` are one-based inclusive coordinates into the stored fragment sequence.
- `features` preserve imported GenBank feature labels and raw locations.
- `reverseComplemented` is stored in the project model even though the current design engine does not yet fully apply that flag throughout final-product construction.

## Coding intent

```ts
type CodingIntent = {
  upstreamFrame: 0 | 1 | 2;
  downstreamFrame: 0 | 1 | 2;
  retainUpstreamStop: boolean;
  retainDownstreamStart: boolean;
  linkerRequired: boolean;
  preserveProtein: boolean;
  flexibleCodons: number;
};
```

This section records biological intent separately from the final computed design.

## Change approvals

```ts
type ChangeApprovals = {
  removeUpstreamStop: boolean;
  removeDownstreamStart: boolean;
  acceptedSynonymousChanges: string[];
};
```

This section is important because the engine may propose coding-sequence changes that remain pending until explicitly approved.

## Reaction conditions

```ts
type ThermodynamicConditions = {
  monovalentMillimolar: number;
  magnesiumMillimolar: number;
  dntpMillimolar: number;
  oligoNanomolar: number;
  dmsoPercent: number;
  dmsoFactor: number;
};
```

These conditions affect Tm calculations and protocol exports.

## Protocol settings

```ts
type ProtocolSettings = {
  stageAConcentrationNgPerUl: number;
  stageBConcentrationNgPerUl: number;
  totalTemplatePmol: number;
  mixStrategy: 'equimolar' | 'user-defined' | 'limiting-a' | 'limiting-b';
  stageMixRatioA: number;
  stageMixRatioB: number;
  primerStockMicromolar: number;
  primerWorkingMicromolar: number;
  workingStockPrepMicroliters: number;
  primerPerReactionMicroliters: number;
  stage1TemplatePerReactionMicroliters: number;
  reactionVolumeMicroliters: number;
  stage1ReactionCountPerProduct: number;
  finalReactionCount: number;
  overfillPercent: number;
  stage1Cycles: number;
  finalCycles: number;
};
```

## Editor locks

```ts
type EditorLocks = {
  fragmentA: boolean;
  fragmentB: boolean;
  fragmentABoundaries: boolean;
  fragmentBBoundaries: boolean;
  insertSequence: boolean;
  polymeraseSettings: boolean;
};
```

These values are UI-state inputs that also affect permitted editing operations.

## Genomic specificity handoff settings

```ts
type GenomicSpecificitySettings = {
  organism: string;
  database: string;
  notes: string;
};
```

These values are used by the Primer-BLAST handoff export.

## Example

```json
{
  "schemaVersion": "0.2.0",
  "engineVersion": "0.2.0",
  "name": "Example fusion",
  "polymeraseId": "q5",
  "mode": "exact",
  "insertSequence": "GGTGGT",
  "notes": "",
  "coding": {
    "upstreamFrame": 0,
    "downstreamFrame": 0,
    "retainUpstreamStop": false,
    "retainDownstreamStart": false,
    "linkerRequired": false,
    "preserveProtein": false,
    "flexibleCodons": 0
  },
  "reactionConditions": {
    "monovalentMillimolar": 50,
    "magnesiumMillimolar": 1.5,
    "dntpMillimolar": 0.2,
    "oligoNanomolar": 500,
    "dmsoPercent": 0,
    "dmsoFactor": 0.6
  },
  "protocolSettings": {
    "stageAConcentrationNgPerUl": 15,
    "stageBConcentrationNgPerUl": 15,
    "totalTemplatePmol": 0.05,
    "mixStrategy": "equimolar",
    "stageMixRatioA": 1,
    "stageMixRatioB": 1,
    "primerStockMicromolar": 100,
    "primerWorkingMicromolar": 10,
    "workingStockPrepMicroliters": 100,
    "primerPerReactionMicroliters": 1,
    "stage1TemplatePerReactionMicroliters": 1,
    "reactionVolumeMicroliters": 25,
    "stage1ReactionCountPerProduct": 2,
    "finalReactionCount": 1,
    "overfillPercent": 10,
    "stage1Cycles": 28,
    "finalCycles": 22
  },
  "editorLocks": {
    "fragmentA": false,
    "fragmentB": false,
    "fragmentABoundaries": false,
    "fragmentBBoundaries": false,
    "insertSequence": false,
    "polymeraseSettings": false
  },
  "changeApprovals": {
    "removeUpstreamStop": false,
    "removeDownstreamStart": false,
    "acceptedSynonymousChanges": []
  },
  "genomicSpecificity": {
    "organism": "",
    "database": "refseq_representative_genomes",
    "notes": ""
  },
  "fragmentA": {
    "label": "Fragment A",
    "sequence": "ATGC...",
    "start": 1,
    "end": 120,
    "topology": "linear",
    "sourceFormat": "plain",
    "importedName": "Fragment A",
    "checksum": "fnv1a-00000000",
    "ambiguousBases": [],
    "features": [],
    "reverseComplemented": false
  },
  "fragmentB": {
    "label": "Fragment B",
    "sequence": "ATGC...",
    "start": 1,
    "end": 95,
    "topology": "linear",
    "sourceFormat": "plain",
    "importedName": "Fragment B",
    "checksum": "fnv1a-00000000",
    "ambiguousBases": [],
    "features": [],
    "reverseComplemented": false
  },
  "createdAt": "2026-07-11T00:00:00.000Z",
  "modifiedAt": "2026-07-11T00:00:00.000Z"
}
```

## Normalization and import behavior

When a project file is loaded:

- missing optional sections are filled from defaults
- reaction conditions and protocol settings are clamped to safe numeric ranges
- fragment metadata is normalized
- timestamps are backfilled if missing

This logic currently lives in `normalizeImportedProject()` in `src/App.tsx` and the normalization helpers in `src/utils/fusion.ts`.

## Migration strategy

The current repository does not yet ship a dedicated multi-version migration module.
Instead, the import path performs tolerant normalization into the current `FusionProjectInput` structure.

Recommended future work:

- add explicit per-version migrations
- separate persisted domain data from transient UI state
- define JSON Schema or Zod-style validation for project files
