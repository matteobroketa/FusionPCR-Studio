import { checksumSequence, createEmptyFragment, type FragmentInput } from './fusion';
import { findInvalidBases, normalizeSequence } from './pcr';

export type EditorLocks = {
  fragmentA: boolean;
  fragmentB: boolean;
  fragmentABoundaries: boolean;
  fragmentBBoundaries: boolean;
  insertSequence: boolean;
  polymeraseSettings: boolean;
};

export function defaultEditorLocks(): EditorLocks {
  return {
    fragmentA: false,
    fragmentB: false,
    fragmentABoundaries: false,
    fragmentBBoundaries: false,
    insertSequence: false,
    polymeraseSettings: false,
  };
}

function normalizePayload(payloadInput: string): string {
  const normalized = normalizeSequence(payloadInput);
  const invalid = findInvalidBases(normalized, true);
  if (invalid.length) {
    throw new Error(`Payload contains unsupported bases: ${invalid.join(', ')}`);
  }
  return normalized;
}

function withSequenceMetadata(fragment: FragmentInput, sequence: string, start: number, end: number): FragmentInput {
  return {
    ...fragment,
    sequence,
    start,
    end,
    checksum: checksumSequence(sequence),
    ambiguousBases: Array.from(new Set(sequence.match(/N/g) ?? [])),
    features: [],
    sourceFormat: 'manual',
    reverseComplemented: false,
  };
}

export function trimFragment(fragment: FragmentInput, side: 'left' | 'right', amount: number): FragmentInput {
  const sequence = normalizeSequence(fragment.sequence);
  const safeAmount = Math.max(0, Math.floor(amount));
  const trimmedAmount = Math.min(safeAmount, Math.max(0, sequence.length - 1));
  const nextSequence = side === 'left' ? sequence.slice(trimmedAmount) : sequence.slice(0, sequence.length - trimmedAmount);
  const nextStart = Math.max(1, Math.min(fragment.start - (side === 'left' ? trimmedAmount : 0), nextSequence.length || 1));
  const nextEnd = Math.max(nextStart, Math.min(fragment.end - (side === 'left' ? trimmedAmount : 0), nextSequence.length || 1));
  return withSequenceMetadata(fragment, nextSequence, nextStart, nextEnd);
}

export function extractSelectedRange(fragment: FragmentInput): FragmentInput {
  const sequence = normalizeSequence(fragment.sequence);
  const start = Math.max(1, Math.min(fragment.start, sequence.length));
  const end = Math.max(start, Math.min(fragment.end, sequence.length));
  const extracted = sequence.slice(start - 1, end);
  return withSequenceMetadata(fragment, extracted, 1, extracted.length || 1);
}

export function deleteSelectedRange(fragment: FragmentInput): FragmentInput {
  const sequence = normalizeSequence(fragment.sequence);
  const start = Math.max(1, Math.min(fragment.start, sequence.length));
  const end = Math.max(start, Math.min(fragment.end, sequence.length));
  const nextSequence = `${sequence.slice(0, start - 1)}${sequence.slice(end)}`;
  const nextEnd = nextSequence.length ? Math.min(start, nextSequence.length) : 1;
  return withSequenceMetadata(fragment, nextSequence, Math.min(start, nextEnd), nextEnd);
}

export function replaceSelectedRange(fragment: FragmentInput, payloadInput: string): FragmentInput {
  const sequence = normalizeSequence(fragment.sequence);
  const payload = normalizePayload(payloadInput);
  const start = Math.max(1, Math.min(fragment.start, sequence.length || 1));
  const end = Math.max(start, Math.min(fragment.end, sequence.length || 1));
  const nextSequence = `${sequence.slice(0, start - 1)}${payload}${sequence.slice(end)}`;
  const nextStart = payload.length ? start : Math.min(start, nextSequence.length || 1);
  const nextEnd = payload.length ? start + payload.length - 1 : Math.min(nextStart, nextSequence.length || 1);
  return withSequenceMetadata(fragment, nextSequence, nextStart, nextEnd);
}

export function duplicateSelectedRange(fragment: FragmentInput): FragmentInput {
  const sequence = normalizeSequence(fragment.sequence);
  const start = Math.max(1, Math.min(fragment.start, sequence.length));
  const end = Math.max(start, Math.min(fragment.end, sequence.length));
  const selected = sequence.slice(start - 1, end);
  const nextSequence = `${sequence.slice(0, end)}${selected}${sequence.slice(end)}`;
  return withSequenceMetadata(fragment, nextSequence, end + 1, end + selected.length);
}

export function insertAtPosition(fragment: FragmentInput, position: number, payloadInput: string): FragmentInput {
  const sequence = normalizeSequence(fragment.sequence);
  const payload = normalizePayload(payloadInput);
  const safePosition = Math.max(1, Math.min(Math.floor(position), sequence.length + 1));
  const insertionIndex = safePosition - 1;
  const nextSequence = `${sequence.slice(0, insertionIndex)}${payload}${sequence.slice(insertionIndex)}`;
  const nextStart = payload.length ? safePosition : Math.min(safePosition, nextSequence.length || 1);
  const nextEnd = payload.length ? safePosition + payload.length - 1 : Math.min(nextStart, nextSequence.length || 1);
  return withSequenceMetadata(fragment, nextSequence, nextStart, nextEnd);
}

export function splitFragment(fragment: FragmentInput, coordinate: number, leftLabel?: string, rightLabel?: string): [FragmentInput, FragmentInput] {
  const sequence = normalizeSequence(fragment.sequence);
  const safeCoordinate = Math.max(1, Math.min(Math.floor(coordinate), Math.max(sequence.length - 1, 1)));
  const leftSequence = sequence.slice(0, safeCoordinate);
  const rightSequence = sequence.slice(safeCoordinate);
  const left = withSequenceMetadata({ ...fragment, label: leftLabel ?? `${fragment.label} left` }, leftSequence, 1, leftSequence.length || 1);
  const rightBase = createEmptyFragment(rightLabel ?? `${fragment.label} right`);
  const right = withSequenceMetadata({ ...rightBase, label: rightLabel ?? `${fragment.label} right` }, rightSequence, 1, rightSequence.length || 1);
  return [left, right];
}
