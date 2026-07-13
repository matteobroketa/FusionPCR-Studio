import { findInvalidBases, normalizeSequence, reverseComplement } from './pcr';
import {
  checksumSequence,
  type SequenceFeature,
  type SequenceTopology,
  type SourceFormat,
} from './fusion';

export type ImportedSource = {
  name: string;
  sequence: string;
  topology: SequenceTopology;
  format: Exclude<SourceFormat, 'manual' | 'project'>;
  features: SequenceFeature[];
  checksum: string;
  ambiguousBases: string[];
  reverseComplemented: boolean;
};

export type ImportParseResult = {
  format: 'plain' | 'fasta' | 'genbank';
  records: ImportedSource[];
  warnings: string[];
};

function detectProteinLikeInput(rawInput: string): boolean {
  const letters = rawInput.toUpperCase().replace(/[^A-Z]/g, '');
  if (!letters.length) {
    return false;
  }

  const dnaLetters = letters.replace(/[ACGTN]/g, '');
  return dnaLetters.length > 0 && dnaLetters.length / letters.length > 0.25;
}

function validateDnaSequence(sequenceInput: string): {
  sequence: string;
  ambiguousBases: string[];
} {
  const sequence = normalizeSequence(sequenceInput);
  if (!sequence.length) {
    throw new Error('No DNA sequence was found in the imported content.');
  }

  const invalidBases = findInvalidBases(sequence, true);
  if (invalidBases.length) {
    if (detectProteinLikeInput(sequence)) {
      throw new Error(
        'The imported content looks like a protein sequence rather than DNA.',
      );
    }

    const unsupportedAmbiguity = invalidBases.filter((base) =>
      /^[A-Z]$/.test(base),
    );
    if (unsupportedAmbiguity.length) {
      throw new Error(
        `Unsupported ambiguity symbols: ${unsupportedAmbiguity.join(', ')}. Only A, C, G, T, and N are supported right now.`,
      );
    }

    throw new Error(
      `Invalid characters were found in the imported sequence: ${invalidBases.join(', ')}`,
    );
  }

  const ambiguousBases = Array.from(new Set(sequence.match(/N/g) ?? []));
  return { sequence, ambiguousBases };
}

function buildImportedSource(
  name: string,
  sequenceInput: string,
  format: ImportedSource['format'],
  topology: SequenceTopology,
  features: SequenceFeature[] = [],
): ImportedSource {
  const { sequence, ambiguousBases } = validateDnaSequence(sequenceInput);

  return {
    name: name.trim() || 'Imported sequence',
    sequence,
    topology,
    format,
    features,
    checksum: checksumSequence(sequence),
    ambiguousBases,
    reverseComplemented: false,
  };
}

function parsePlainSequence(rawInput: string): ImportParseResult {
  return {
    format: 'plain',
    records: [
      buildImportedSource('Imported sequence', rawInput, 'plain', 'linear'),
    ],
    warnings: [],
  };
}

function parseFasta(rawInput: string): ImportParseResult {
  const lines = rawInput.replace(/\r/g, '').split('\n');
  const records: ImportedSource[] = [];
  const warnings: string[] = [];
  let currentName = '';
  let currentSequenceLines: string[] = [];

  const flush = () => {
    if (!currentName && currentSequenceLines.length === 0) {
      return;
    }

    records.push(
      buildImportedSource(
        currentName || `Sequence ${records.length + 1}`,
        currentSequenceLines.join(''),
        'fasta',
        'linear',
      ),
    );
  };

  for (const line of lines) {
    if (line.startsWith('>')) {
      flush();
      currentName = line.slice(1).trim() || `Sequence ${records.length + 1}`;
      currentSequenceLines = [];
      continue;
    }

    if (line.trim()) {
      currentSequenceLines.push(line.trim());
    }
  }

  flush();

  if (!records.length) {
    throw new Error('No FASTA records were found in the imported content.');
  }

  const duplicateNames = records
    .map((record) => record.name)
    .filter((name, index, allNames) => allNames.indexOf(name) !== index);
  if (duplicateNames.length) {
    throw new Error(
      `Duplicate sequence names were found in the FASTA import: ${Array.from(new Set(duplicateNames)).join(', ')}`,
    );
  }

  if (records.length > 2) {
    warnings.push(
      'More than two FASTA records were imported; apply the desired records to fragments A and B manually.',
    );
  }

  return {
    format: 'fasta',
    records,
    warnings,
  };
}

function parseGenBankFeatures(
  featureText: string,
  topology: SequenceTopology,
): SequenceFeature[] {
  const features: SequenceFeature[] = [];
  const lines = featureText.replace(/\r/g, '').split('\n');
  let currentFeature: SequenceFeature | null = null;

  for (const line of lines) {
    const featureMatch = line.match(/^\s{5}(\S+)\s+(.+)$/);
    if (featureMatch) {
      const location = featureMatch[2].trim();
      const ranges = Array.from(location.matchAll(/(\d+)\.\.(\d+)/g)).map(
        (match) => ({
          start: Number(match[1]),
          end: Number(match[2]),
        }),
      );
      const crossesOrigin =
        topology === 'circular' &&
        ranges.some(
          (range, index) => index > 0 && range.start < ranges[index - 1].start,
        );

      currentFeature = {
        key: featureMatch[1],
        location,
        label: featureMatch[1],
        qualifiers: {},
        crossesOrigin,
      };
      features.push(currentFeature);
      continue;
    }

    const qualifierMatch = line.match(/^\s+\/([^=]+)=?(.*)$/);
    if (qualifierMatch && currentFeature) {
      const qualifierKey = qualifierMatch[1].trim();
      const qualifierValue = qualifierMatch[2].trim().replace(/^"|"$/g, '');
      currentFeature.qualifiers[qualifierKey] = qualifierValue;
      if (
        qualifierKey === 'label' ||
        qualifierKey === 'gene' ||
        qualifierKey === 'product'
      ) {
        currentFeature.label = qualifierValue || currentFeature.label;
      }
    }
  }

  return features;
}

function parseGenBank(rawInput: string): ImportParseResult {
  const locusMatch = rawInput.match(/^LOCUS\s+(\S+).*(linear|circular)/im);
  const name = locusMatch?.[1] ?? 'GenBank import';
  const topology =
    locusMatch?.[2]?.toLowerCase() === 'circular' ? 'circular' : 'linear';
  const originMatch = rawInput.match(/^ORIGIN([\s\S]+?)^\/\/\s*$/im);

  if (!originMatch) {
    throw new Error('The GenBank record does not contain an ORIGIN section.');
  }

  const featureSectionMatch = rawInput.match(
    /^FEATURES\s+Location\/Qualifiers([\s\S]+?)^ORIGIN/im,
  );
  const features = parseGenBankFeatures(
    featureSectionMatch?.[1] ?? '',
    topology,
  );
  const sequence = originMatch[1].replace(/[^A-Za-z]/g, '');
  const warnings: string[] = [];

  if (topology === 'circular') {
    warnings.push(
      'Circular topology was detected. Circular source selections can wrap around the origin, while more complex circular editing remains limited.',
    );
  }
  if (features.some((feature) => feature.crossesOrigin)) {
    warnings.push(
      'One or more GenBank features cross the circular origin and are preserved as raw feature locations.',
    );
  }

  return {
    format: 'genbank',
    records: [
      buildImportedSource(name, sequence, 'genbank', topology, features),
    ],
    warnings,
  };
}

export function parseSequenceImport(rawInput: string): ImportParseResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Import content is empty.');
  }

  if (/^LOCUS\s+/im.test(trimmed) && /^ORIGIN/im.test(trimmed)) {
    return parseGenBank(trimmed);
  }

  if (/^>/m.test(trimmed)) {
    return parseFasta(trimmed);
  }

  return parsePlainSequence(trimmed);
}

export function flipImportedSource(source: ImportedSource): ImportedSource {
  const sequence = reverseComplement(source.sequence);
  return {
    ...source,
    sequence,
    checksum: checksumSequence(sequence),
    reverseComplemented: !source.reverseComplemented,
  };
}
