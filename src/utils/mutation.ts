import { checksumSequence, createEmptyFragment, type FragmentInput } from './fusion';
import { findInvalidBases, normalizeSequence } from './pcr';

export type MutationPlannerMode = 'insertion' | 'deletion' | 'substitution' | 'domain-swap';

export type MutationPlan = {
  mode: MutationPlannerMode;
  leftFragment: FragmentInput;
  rightFragment: FragmentInput;
  insertSequence: string;
  removedSequence: string;
  targetSequence: string;
  summary: string;
};

function clampCoordinate(length: number, coordinate: number): number {
  return Math.max(1, Math.min(Math.floor(coordinate), Math.max(length + 1, 1)));
}

function clampRange(length: number, start: number, end: number): { start: number; end: number } {
  const safeStart = Math.max(1, Math.min(Math.floor(start), Math.max(length, 1)));
  const safeEnd = Math.max(1, Math.min(Math.floor(end), Math.max(length, 1)));
  return {
    start: Math.min(safeStart, safeEnd),
    end: Math.max(safeStart, safeEnd),
  };
}

function normalizePayload(payloadInput: string): string {
  const payload = normalizeSequence(payloadInput);
  const invalid = findInvalidBases(payload, true);
  if (invalid.length) {
    throw new Error(`Payload contains unsupported bases: ${invalid.join(', ')}`);
  }
  return payload;
}

function makePlannerFragment(label: string, sequence: string): FragmentInput {
  const fragment = createEmptyFragment(label);
  return {
    ...fragment,
    label,
    sequence,
    start: 1,
    end: sequence.length || 1,
    checksum: checksumSequence(sequence),
    ambiguousBases: Array.from(new Set(sequence.match(/N/g) ?? [])),
    sourceFormat: 'manual',
  };
}

export function selectedFragmentSequence(fragment: FragmentInput): string {
  const sequence = normalizeSequence(fragment.sequence);
  if (!sequence.length) {
    return '';
  }
  const { start, end } = clampRange(sequence.length, fragment.start, fragment.end);
  return sequence.slice(start - 1, end);
}

export function buildMutationPlan(input: {
  mode: MutationPlannerMode;
  recipient: FragmentInput;
  payloadInput?: string;
  coordinate?: number;
  start?: number;
  end?: number;
  recipientLabel?: string;
}): MutationPlan {
  const sequence = normalizeSequence(input.recipient.sequence);
  if (!sequence.length) {
    throw new Error('Recipient fragment is empty.');
  }

  const recipientLabel = input.recipientLabel ?? input.recipient.label;

  if (input.mode === 'insertion') {
    const payload = normalizePayload(input.payloadInput ?? '');
    if (!payload.length) {
      throw new Error('Insertion mode requires a non-empty payload.');
    }

    const coordinate = clampCoordinate(sequence.length, input.coordinate ?? input.start ?? 1);
    const left = sequence.slice(0, coordinate - 1);
    const right = sequence.slice(coordinate - 1);
    return {
      mode: input.mode,
      leftFragment: makePlannerFragment(`${recipientLabel} left flank`, left),
      rightFragment: makePlannerFragment(`${recipientLabel} right flank`, right),
      insertSequence: payload,
      removedSequence: '',
      targetSequence: `${left}${payload}${right}`,
      summary: `Insert ${payload.length} bp at coordinate ${coordinate} in ${recipientLabel}.`,
    };
  }

  const { start, end } = clampRange(sequence.length, input.start ?? 1, input.end ?? Math.max(1, input.start ?? 1));
  const left = sequence.slice(0, start - 1);
  const removedSequence = sequence.slice(start - 1, end);
  const right = sequence.slice(end);
  const payload = input.mode === 'deletion' ? '' : normalizePayload(input.payloadInput ?? '');

  if ((input.mode === 'substitution' || input.mode === 'domain-swap') && !payload.length) {
    throw new Error(`${input.mode === 'domain-swap' ? 'Domain swap' : 'Substitution'} mode requires a non-empty payload.`);
  }

  return {
    mode: input.mode,
    leftFragment: makePlannerFragment(`${recipientLabel} left flank`, left),
    rightFragment: makePlannerFragment(`${recipientLabel} right flank`, right),
    insertSequence: payload,
    removedSequence,
    targetSequence: `${left}${payload}${right}`,
    summary:
      input.mode === 'deletion'
        ? `Delete ${removedSequence.length} bp from ${recipientLabel} at ${start}-${end}.`
        : `Replace ${removedSequence.length} bp in ${recipientLabel} at ${start}-${end} with ${payload.length} bp.`,
  };
}
