import type { SequenceFeature, SequenceTopology } from './fusion';

export type ParsedFeatureSelection = {
  start: number;
  end: number;
  complement: boolean;
  wrapsOrigin: boolean;
  supported: boolean;
  reason?: string;
};

type SimpleLocation = {
  start: number;
  end: number;
};

function parseLocationRange(range: string): SimpleLocation | null {
  const match = range.trim().match(/^<?(\d+)\.\.>?(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    start: Number.parseInt(match[1], 10),
    end: Number.parseInt(match[2], 10),
  };
}

function parseJoinLocation(joinBody: string): SimpleLocation[] {
  return joinBody
    .split(',')
    .map((part) => parseLocationRange(part))
    .filter((item): item is SimpleLocation => item !== null);
}

export function parseFeatureSelection(
  location: string,
  topology: SequenceTopology,
): ParsedFeatureSelection | null {
  const trimmed = location.trim();
  const complementMatch = trimmed.match(/^complement\((.+)\)$/i);
  const complement = Boolean(complementMatch);
  const innerLocation = complementMatch ? complementMatch[1].trim() : trimmed;

  const simple = parseLocationRange(innerLocation);
  if (simple) {
    return {
      start: simple.start,
      end: simple.end,
      complement,
      wrapsOrigin: false,
      supported: true,
    };
  }

  const joinMatch = innerLocation.match(/^join\((.+)\)$/i);
  if (!joinMatch) {
    return {
      start: 1,
      end: 1,
      complement,
      wrapsOrigin: false,
      supported: false,
      reason: 'Only simple interval and two-part circular origin joins are currently selectable.',
    };
  }

  const ranges = parseJoinLocation(joinMatch[1]);
  if (ranges.length !== 2) {
    return {
      start: 1,
      end: 1,
      complement,
      wrapsOrigin: false,
      supported: false,
      reason: 'Only two-part join locations are currently selectable.',
    };
  }

  if (topology !== 'circular') {
    return {
      start: 1,
      end: 1,
      complement,
      wrapsOrigin: false,
      supported: false,
      reason: 'Join locations are currently selectable only on circular templates that cross the origin.',
    };
  }

  if (ranges[1].start >= ranges[0].start) {
    return {
      start: 1,
      end: 1,
      complement,
      wrapsOrigin: false,
      supported: false,
      reason: 'Only origin-crossing join locations are currently selectable.',
    };
  }

  return {
    start: ranges[0].start,
    end: ranges[1].end,
    complement,
    wrapsOrigin: true,
    supported: true,
  };
}

export function describeFeatureSelection(feature: SequenceFeature, topology: SequenceTopology): string {
  const parsed = parseFeatureSelection(feature.location, topology);
  if (!parsed) {
    return 'Unsupported feature location.';
  }

  if (!parsed.supported) {
    return parsed.reason ?? 'Unsupported feature location.';
  }

  const directionNote = parsed.complement ? ' complement strand' : '';
  const wrapNote = parsed.wrapsOrigin ? ' wraparound' : '';
  return `${parsed.start}-${parsed.end}${wrapNote}${directionNote}`.trim();
}
