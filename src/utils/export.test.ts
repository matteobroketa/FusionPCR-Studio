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
  type SequenceFeature,
} from './fusion';
import {
  buildAnnotatedGenbank,
  buildCalculationManifest,
  buildExpectedGelDiagram,
  buildFinalConstructFasta,
  buildJunctionReport,
  buildPipettingTableCsv,
  buildPrimerBlastPackage,
  buildStageProductFasta,
  buildThermocyclerProgram,
  buildValidationReport,
} from './export';

function makeFragment(
  label: string,
  sequence: string,
  start = 1,
  end = sequence.length,
  features: SequenceFeature[] = [],
): FragmentInput {
  return {
    label,
    sequence,
    start,
    end,
    topology: 'linear',
    sourceFormat: features.length ? 'genbank' : 'plain',
    importedName: label,
    checksum: checksumSequence(sequence),
    ambiguousBases: [],
    features,
    reverseComplemented: false,
  };
}

function buildTestDesign() {
  return buildFusionDesign({
    schemaVersion: PROJECT_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    createdAt: '2026-07-11T00:00:00.000Z',
    modifiedAt: '2026-07-11T00:00:00.000Z',
    mode: 'exact',
    name: 'Export test',
    polymeraseId: 'q5',
    insertSequence: 'GGTGGT',
    notes: 'Expanded export coverage.',
    coding: defaultCodingIntent(),
    reactionConditions: defaultReactionConditions(),
    protocolSettings: defaultProtocolConfig(),
    editorLocks: defaultEditorLockConfig(),
    changeApprovals: defaultChangeApprovals(),
    genomicSpecificity: {
      ...defaultGenomicSpecificitySettings(),
      organism: 'Homo sapiens',
      database: 'RefSeq representative genomes',
      notes: 'Check the final PCR pair against the human genome.',
    },
    fragmentA: makeFragment('A', 'ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG', 1, 39, [
      {
        key: 'CDS',
        location: '4..18',
        label: 'Fragment A CDS',
        qualifiers: { gene: 'fusA' },
        crossesOrigin: false,
      },
    ]),
    fragmentB: makeFragment('B', 'GGCAGCGGCGGATCCGATGGTGAGCAAGGGCGAGGAGCTG', 1, 42, [
      {
        key: 'misc_feature',
        location: '7..16',
        label: 'Fragment B marker',
        qualifiers: { note: 'donor region' },
        crossesOrigin: false,
      },
    ]),
  });
}

describe('export helpers', () => {
  it('builds a Primer-BLAST handoff package', () => {
    const design = buildTestDesign();

    const handoff = buildPrimerBlastPackage(design);
    expect(handoff).toContain('Homo sapiens');
    expect(handoff).toContain('Primer-BLAST URL');
    expect(handoff).toContain('Fusion PCR');
    expect(handoff).toContain('Forward primer:');
    expect(handoff).toContain('Submitting these primers or targets to Primer-BLAST will send sequence information outside this local-first application.');
  });

  it('builds the expanded export artifacts', () => {
    const design = buildTestDesign();

    const finalFasta = buildFinalConstructFasta(design);
    expect(finalFasta).toContain('final_construct');
    expect(finalFasta.replace(/\s+/g, '')).toContain(design.finalProduct);

    const stageFasta = buildStageProductFasta(design);
    expect(stageFasta).toContain('PCR_1A_product');
    expect(stageFasta.replace(/\s+/g, '')).toContain(design.stageAProduct);
    expect(stageFasta.replace(/\s+/g, '')).toContain(design.stageBProduct);

    const genbank = buildAnnotatedGenbank(design);
    expect(genbank).toContain('FEATURES             Location/Qualifiers');
    expect(genbank).toContain('/label="Fragment A CDS"');
    expect(genbank).toContain('/label="Fragment B marker"');

    const pipetting = buildPipettingTableCsv(design);
    expect(pipetting).toContain('reaction-recipe');
    expect(pipetting).toContain('PCR 1A');

    const thermocycler = buildThermocyclerProgram(design);
    expect(thermocycler).toContain('Initial denaturation: 98 C for 30 s');
    expect(thermocycler).toContain('Fusion PCR');

    const junctionReport = buildJunctionReport(design);
    expect(junctionReport).toContain('Final junction:');
    expect(junctionReport).toContain('Overlap sequence:');

    const validationReport = buildValidationReport(design);
    expect(validationReport).toContain('Exact fusion verified: yes');
    expect(validationReport).toContain('Quality score');

    const gelDiagram = buildExpectedGelDiagram(design);
    expect(gelDiagram).toContain('Lane 1 PCR 1A');
    expect(gelDiagram).toContain('Expected interpretation');

    const manifest = JSON.parse(buildCalculationManifest(design)) as {
      project: { mode: string };
      methods: { genbankAnnotationPolicy: string };
      validation: { exactFusionVerified: boolean };
    };
    expect(manifest.project.mode).toBe('exact');
    expect(manifest.methods.genbankAnnotationPolicy).toContain('Selected source features are mapped only');
    expect(manifest.validation.exactFusionVerified).toBe(true);
  });
});
