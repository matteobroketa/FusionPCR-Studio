import { checksumSequence, type FragmentInput } from './fusion';
import { buildMutationPlan, selectedFragmentSequence } from './mutation';

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

describe('mutation planner', () => {
  it('extracts the selected fragment sequence', () => {
    expect(selectedFragmentSequence(makeFragment('A', 'AACCGGTT', 3, 6))).toBe('CCGG');
  });

  it('builds an insertion plan', () => {
    const plan = buildMutationPlan({
      mode: 'insertion',
      recipient: makeFragment('Recipient', 'AACCGGTT'),
      coordinate: 5,
      payloadInput: 'TTAA',
    });

    expect(plan.leftFragment.sequence).toBe('AACC');
    expect(plan.rightFragment.sequence).toBe('GGTT');
    expect(plan.insertSequence).toBe('TTAA');
    expect(plan.targetSequence).toBe('AACCTTAAGGTT');
  });

  it('builds a deletion plan', () => {
    const plan = buildMutationPlan({
      mode: 'deletion',
      recipient: makeFragment('Recipient', 'AACCGGTT'),
      start: 3,
      end: 6,
    });

    expect(plan.removedSequence).toBe('CCGG');
    expect(plan.insertSequence).toBe('');
    expect(plan.targetSequence).toBe('AATT');
  });

  it('builds a substitution plan', () => {
    const plan = buildMutationPlan({
      mode: 'substitution',
      recipient: makeFragment('Recipient', 'AACCGGTT'),
      start: 3,
      end: 4,
      payloadInput: 'TTAA',
    });

    expect(plan.removedSequence).toBe('CC');
    expect(plan.insertSequence).toBe('TTAA');
    expect(plan.targetSequence).toBe('AATTAAGGTT');
  });

  it('builds a domain-swap plan from donor payload', () => {
    const donorPayload = selectedFragmentSequence(makeFragment('Donor', 'ATGGCCGGTTAA', 4, 9));
    const plan = buildMutationPlan({
      mode: 'domain-swap',
      recipient: makeFragment('Recipient', 'AACCGGTT'),
      start: 3,
      end: 6,
      payloadInput: donorPayload,
    });

    expect(donorPayload).toBe('GCCGGT');
    expect(plan.insertSequence).toBe('GCCGGT');
    expect(plan.targetSequence).toBe('AAGCCGGTTT');
  });
});
