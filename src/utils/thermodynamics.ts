import { findInvalidBases, normalizeSequence, reverseComplement } from './pcr';

export type ThermodynamicConditions = {
  monovalentMillimolar: number;
  magnesiumMillimolar: number;
  dntpMillimolar: number;
  oligoNanomolar: number;
  dmsoPercent: number;
  dmsoFactor: number;
};

export type ThermodynamicResult = {
  sequence: string;
  length: number;
  gcFraction: number;
  deltaHKcalPerMol: number;
  deltaSCalPerMolK: number;
  rawTmCelsius: number;
  correctedTmCelsius: number;
  saltCorrection: number;
  selfComplementary: boolean;
  effectiveFreeMagnesiumMolar: number;
  divalentToMonovalentRatio: number;
};

const GAS_CONSTANT = 1.9872;
const KELVIN_OFFSET = 273.15;
const CROSSOVER_POINT = 0.22;

const SANTA_LUCIA_1998_DH: Record<string, number> = {
  AA: -7.9,
  AC: -8.4,
  AG: -7.8,
  AT: -7.2,
  CA: -8.5,
  CC: -8.0,
  CG: -10.6,
  CT: -7.8,
  GA: -8.2,
  GC: -9.8,
  GG: -8.0,
  GT: -8.4,
  TA: -7.2,
  TC: -8.2,
  TG: -8.5,
  TT: -7.9,
};

const SANTA_LUCIA_1998_DS: Record<string, number> = {
  AA: -22.2,
  AC: -22.4,
  AG: -21.0,
  AT: -20.4,
  CA: -22.7,
  CC: -19.9,
  CG: -27.2,
  CT: -21.0,
  GA: -22.2,
  GC: -24.4,
  GG: -19.9,
  GT: -22.4,
  TA: -21.3,
  TC: -22.2,
  TG: -22.7,
  TT: -22.2,
};

export function defaultThermodynamicConditions(): ThermodynamicConditions {
  return {
    monovalentMillimolar: 50,
    magnesiumMillimolar: 1.5,
    dntpMillimolar: 0.2,
    oligoNanomolar: 500,
    dmsoPercent: 0,
    dmsoFactor: 0.6,
  };
}

export function isSelfComplementary(sequenceInput: string): boolean {
  const sequence = normalizeSequence(sequenceInput);
  return sequence.length > 0 && reverseComplement(sequence) === sequence;
}

export function divalentToMonovalentEquivalent(divalentMillimolar: number, dntpMillimolar: number): number {
  const safeDivalent = Math.max(0, divalentMillimolar);
  const safeDntp = Math.max(0, dntpMillimolar);
  const effectiveDivalent = Math.max(safeDivalent, safeDntp);
  return 120 * Math.sqrt(effectiveDivalent - safeDntp);
}

function countGcFraction(sequence: string): number {
  if (!sequence.length) {
    return 0;
  }

  let gcCount = 0;
  for (const base of sequence) {
    if (base === 'G' || base === 'C') {
      gcCount += 1;
    }
  }

  return gcCount / sequence.length;
}

function sumNearestNeighbor(sequence: string): { deltaH: number; deltaS: number } {
  let deltaH = 0;
  let deltaS = 0;

  if (isSelfComplementary(sequence)) {
    deltaS -= 1.4;
  }

  const firstBase = sequence[0];
  const lastBase = sequence[sequence.length - 1];

  if (firstBase === 'A' || firstBase === 'T') {
    deltaH += 2.3;
    deltaS += 4.1;
  } else if (firstBase === 'C' || firstBase === 'G') {
    deltaH += 0.1;
    deltaS -= 2.8;
  }

  if (lastBase === 'A' || lastBase === 'T') {
    deltaH += 2.3;
    deltaS += 4.1;
  } else if (lastBase === 'C' || lastBase === 'G') {
    deltaH += 0.1;
    deltaS -= 2.8;
  }

  for (let index = 0; index < sequence.length - 1; index += 1) {
    const pair = sequence.slice(index, index + 2);
    deltaH += SANTA_LUCIA_1998_DH[pair];
    deltaS += SANTA_LUCIA_1998_DS[pair];
  }

  return { deltaH, deltaS };
}

function calculateRawTmKelvin(sequence: string, deltaH: number, deltaS: number, oligoNanomolar: number): number {
  const concentration = Math.max(oligoNanomolar, 1e-6);
  const concentrationMolar = concentration / 1_000_000_000;
  const symmetryDivisor = isSelfComplementary(sequence) ? 1_000_000_000 : 4_000_000_000;
  return (deltaH * 1000) / (deltaS + GAS_CONSTANT * Math.log(concentration / symmetryDivisor));
}

function calculateOwczarzySaltCorrection(sequence: string, conditions: ThermodynamicConditions): {
  correction: number;
  freeMagnesiumMolar: number;
  divalentToMonovalentRatio: number;
} {
  const monovalentMolar = Math.max(conditions.monovalentMillimolar, 0.000001) / 1000;
  const gcFraction = countGcFraction(sequence);
  const freeMagnesiumMolar =
    conditions.dntpMillimolar >= conditions.magnesiumMillimolar
      ? 1e-11
      : Math.max(conditions.magnesiumMillimolar - conditions.dntpMillimolar, 1e-8) / 1000;
  const divalentToMonovalentRatio =
    conditions.monovalentMillimolar <= 0
      ? 6
      : Math.sqrt(freeMagnesiumMolar) / monovalentMolar;
  let correction = 0;

  if (divalentToMonovalentRatio < CROSSOVER_POINT) {
    const logMonovalent = Math.log(monovalentMolar);
    correction = (((4.29 * gcFraction) - 3.95) * 1e-5 * logMonovalent) + (9.4e-6 * Math.pow(logMonovalent, 2));
  } else {
    const logFreeMagnesium = Math.log(freeMagnesiumMolar);
    const logMonovalent = Math.log(monovalentMolar);
    let a = 3.92e-5;
    const b = -9.11e-6;
    const c = 6.26e-5;
    let d = 1.42e-5;
    const e = -4.82e-4;
    const f = 5.25e-4;
    let g = 8.31e-5;

    if (divalentToMonovalentRatio < 6) {
      a = 3.92e-5 * (0.843 - (0.352 * Math.sqrt(monovalentMolar) * logMonovalent));
      d = 1.42e-5 * (1.279 - 4.03e-3 * logMonovalent - 8.03e-3 * Math.pow(logMonovalent, 2));
      g = 8.31e-5 * (0.486 - 0.258 * logMonovalent + 5.25e-3 * Math.pow(logMonovalent, 3));
    }

    correction =
      a +
      (b * logFreeMagnesium) +
      gcFraction * (c + (d * logFreeMagnesium)) +
      (1 / (2 * (sequence.length - 1))) * (e + (f * logFreeMagnesium) + g * Math.pow(logFreeMagnesium, 2));
  }

  return {
    correction,
    freeMagnesiumMolar,
    divalentToMonovalentRatio,
  };
}

function buildInvalidThermodynamicResult(
  sequence: string,
  gcFraction: number,
  reason: 'empty' | 'too-short' | 'invalid-bases',
): ThermodynamicResult {
  const placeholder = reason === 'empty' ? 0 : Number.NaN;
  return {
    sequence,
    length: sequence.length,
    gcFraction,
    deltaHKcalPerMol: placeholder,
    deltaSCalPerMolK: placeholder,
    rawTmCelsius: placeholder,
    correctedTmCelsius: placeholder,
    saltCorrection: placeholder,
    selfComplementary: false,
    effectiveFreeMagnesiumMolar: placeholder,
    divalentToMonovalentRatio: placeholder,
  };
}

export function calculateNearestNeighborTm(
  sequenceInput: string,
  conditionsInput: ThermodynamicConditions,
): ThermodynamicResult {
  const sequence = normalizeSequence(sequenceInput);
  if (!sequence.length) {
    return buildInvalidThermodynamicResult('', 0, 'empty');
  }

  if (findInvalidBases(sequence, false).length) {
    return buildInvalidThermodynamicResult(sequence, countGcFraction(sequence), 'invalid-bases');
  }

  if (sequence.length < 2) {
    return buildInvalidThermodynamicResult(sequence, countGcFraction(sequence), 'too-short');
  }

  const conditions: ThermodynamicConditions = {
    monovalentMillimolar: Math.max(conditionsInput.monovalentMillimolar, 0),
    magnesiumMillimolar: Math.max(conditionsInput.magnesiumMillimolar, 0),
    dntpMillimolar: Math.max(conditionsInput.dntpMillimolar, 0),
    oligoNanomolar: Math.max(conditionsInput.oligoNanomolar, 1e-6),
    dmsoPercent: Math.max(conditionsInput.dmsoPercent, 0),
    dmsoFactor: Math.max(conditionsInput.dmsoFactor, 0),
  };

  const { deltaH, deltaS } = sumNearestNeighbor(sequence);
  const rawTmKelvin = calculateRawTmKelvin(sequence, deltaH, deltaS, conditions.oligoNanomolar);
  const rawTmCelsius = rawTmKelvin - KELVIN_OFFSET;
  const salt = calculateOwczarzySaltCorrection(sequence, conditions);
  const correctedTmCelsius = (1 / ((1 / rawTmKelvin) + salt.correction)) - KELVIN_OFFSET - (conditions.dmsoPercent * conditions.dmsoFactor);

  return {
    sequence,
    length: sequence.length,
    gcFraction: countGcFraction(sequence),
    deltaHKcalPerMol: deltaH,
    deltaSCalPerMolK: deltaS,
    rawTmCelsius,
    correctedTmCelsius,
    saltCorrection: salt.correction,
    selfComplementary: isSelfComplementary(sequence),
    effectiveFreeMagnesiumMolar: salt.freeMagnesiumMolar,
    divalentToMonovalentRatio: salt.divalentToMonovalentRatio,
  };
}
