import type { SequenceFeature } from './fusion';
import { describeFeatureSelection, parseFeatureSelection } from './features';

function feature(location: string): SequenceFeature {
  return {
    key: 'CDS',
    location,
    label: 'Example feature',
    qualifiers: {},
    crossesOrigin: false,
  };
}

describe('feature location parsing', () => {
  it('parses simple interval locations', () => {
    expect(parseFeatureSelection('5..18', 'linear')).toEqual({
      start: 5,
      end: 18,
      complement: false,
      wrapsOrigin: false,
      supported: true,
    });
  });

  it('parses complement interval locations', () => {
    expect(parseFeatureSelection('complement(22..41)', 'linear')).toEqual({
      start: 22,
      end: 41,
      complement: true,
      wrapsOrigin: false,
      supported: true,
    });
  });

  it('parses two-part circular joins as wraparound selections', () => {
    expect(parseFeatureSelection('join(10..12,1..6)', 'circular')).toEqual({
      start: 10,
      end: 6,
      complement: false,
      wrapsOrigin: true,
      supported: true,
    });
  });

  it('rejects unsupported join structures', () => {
    const parsed = parseFeatureSelection('join(5..10,20..25)', 'linear');
    expect(parsed?.supported).toBe(false);
    expect(parsed?.reason).toContain('circular templates');
  });

  it('describes parsed feature selections for the UI', () => {
    expect(
      describeFeatureSelection(feature('complement(22..41)'), 'linear'),
    ).toBe('22-41 complement strand');
    expect(
      describeFeatureSelection(feature('join(10..12,1..6)'), 'circular'),
    ).toBe('10-6 wraparound');
  });
});
