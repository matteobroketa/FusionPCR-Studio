import { checksumSequence, type FragmentInput } from './fusion';
import {
  defaultEditorLocks,
  deleteSelectedRange,
  duplicateSelectedRange,
  extractSelectedRange,
  insertAtPosition,
  replaceSelectedRange,
  splitFragment,
  trimFragment,
} from './editor';

function makeFragment(sequence: string, start = 2, end = 5): FragmentInput {
  return {
    label: 'Fragment',
    sequence,
    start,
    end,
    topology: 'linear',
    sourceFormat: 'manual',
    importedName: 'Fragment',
    checksum: checksumSequence(sequence),
    ambiguousBases: [],
    features: [],
    reverseComplemented: false,
  };
}

describe('editor operations', () => {
  it('provides unlocked defaults', () => {
    expect(defaultEditorLocks()).toEqual({
      fragmentA: false,
      fragmentB: false,
      fragmentABoundaries: false,
      fragmentBBoundaries: false,
      insertSequence: false,
      polymeraseSettings: false,
    });
  });

  it('trims a fragment from the left', () => {
    const fragment = trimFragment(makeFragment('AACCGGTT', 3, 6), 'left', 2);
    expect(fragment.sequence).toBe('CCGGTT');
    expect(fragment.start).toBe(1);
    expect(fragment.end).toBe(4);
  });

  it('extracts the selected range', () => {
    const fragment = extractSelectedRange(makeFragment('AACCGGTT', 3, 6));
    expect(fragment.sequence).toBe('CCGG');
    expect(fragment.start).toBe(1);
    expect(fragment.end).toBe(4);
  });

  it('deletes the selected range', () => {
    const fragment = deleteSelectedRange(makeFragment('AACCGGTT', 3, 6));
    expect(fragment.sequence).toBe('AATT');
  });

  it('replaces the selected range with a payload', () => {
    const fragment = replaceSelectedRange(
      makeFragment('AACCGGTT', 3, 6),
      'TTAA',
    );
    expect(fragment.sequence).toBe('AATTAATT');
    expect(fragment.start).toBe(3);
    expect(fragment.end).toBe(6);
  });

  it('duplicates the selected range', () => {
    const fragment = duplicateSelectedRange(makeFragment('AACCGGTT', 3, 4));
    expect(fragment.sequence).toBe('AACCCCGGTT');
    expect(fragment.start).toBe(5);
    expect(fragment.end).toBe(6);
  });

  it('inserts a payload at a position', () => {
    const fragment = insertAtPosition(makeFragment('AACCGGTT', 2, 3), 5, 'TT');
    expect(fragment.sequence).toBe('AACCTTGGTT');
    expect(fragment.start).toBe(5);
    expect(fragment.end).toBe(6);
  });

  it('splits a fragment into two fragments', () => {
    const [left, right] = splitFragment(
      makeFragment('AACCGGTT', 1, 8),
      4,
      'Left',
      'Right',
    );
    expect(left.sequence).toBe('AACC');
    expect(right.sequence).toBe('GGTT');
    expect(left.label).toBe('Left');
    expect(right.label).toBe('Right');
  });
});
