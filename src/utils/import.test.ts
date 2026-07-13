import { flipImportedSource, parseSequenceImport } from './import';

describe('sequence import parser', () => {
  it('parses a plain DNA sequence', () => {
    const result = parseSequenceImport('atg cct\nnnn');

    expect(result.format).toBe('plain');
    expect(result.records).toHaveLength(1);
    expect(result.records[0].sequence).toBe('ATGCCTNNN');
    expect(result.records[0].ambiguousBases).toEqual(['N']);
  });

  it('parses multi-fasta records and preserves names', () => {
    const result = parseSequenceImport('>FragA\nATGC\n>FragB\nGGTT');

    expect(result.format).toBe('fasta');
    expect(result.records).toHaveLength(2);
    expect(result.records[0].name).toBe('FragA');
    expect(result.records[1].name).toBe('FragB');
  });

  it('rejects duplicate fasta names', () => {
    expect(() => parseSequenceImport('>dup\nATGC\n>dup\nGGTT')).toThrow(
      /Duplicate sequence names/,
    );
  });

  it('parses a GenBank record with topology and features', () => {
    const result =
      parseSequenceImport(`LOCUS       TESTSEQ         12 bp    DNA     circular SYN 01-JAN-2000
FEATURES             Location/Qualifiers
     CDS             join(10..12,1..6)
                     /gene="orfA"
ORIGIN
        1 atgcctggttaa
//
`);

    expect(result.format).toBe('genbank');
    expect(result.records[0].topology).toBe('circular');
    expect(result.records[0].features[0].label).toBe('orfA');
    expect(
      result.warnings.some((warning) => warning.includes('Circular topology')),
    ).toBe(true);
  });

  it('flags protein-like imports', () => {
    expect(() => parseSequenceImport('MKWVTFISLL')).toThrow(/protein sequence/);
  });

  it('reverse complements imported sources', () => {
    const source = parseSequenceImport('ATGCCG').records[0];
    const flipped = flipImportedSource(source);

    expect(flipped.sequence).toBe('CGGCAT');
    expect(flipped.reverseComplemented).toBe(true);
  });
});
