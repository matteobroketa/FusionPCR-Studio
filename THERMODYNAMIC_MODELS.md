# Thermodynamic Models

This document records the thermodynamic assumptions currently implemented in `src/utils/thermodynamics.ts` and used throughout the TypeScript design engine.

## Scope

The current implementation provides:

- nearest-neighbour duplex Tm calculation for DNA oligos
- mixed-salt correction with monovalent, magnesium, and dNTP inputs
- optional DMSO adjustment
- reporting for annealing-body, full-oligo, and overlap duplexes

It does not yet provide:

- mismatch thermodynamics
- RNA or DNA/RNA hybrid models
- full loop-and-bulge thermodynamic structure enumeration
- experimentally calibrated polymerase-specific Tm corrections

## Parameter tables

The implementation currently uses SantaLucia 1998 nearest-neighbour dinucleotide enthalpy and entropy tables for canonical DNA duplexes.

`deltaH` values are stored in kcal/mol.
`deltaS` values are stored in cal/mol/K.

The code also applies:

- a symmetry penalty of `-1.4 cal/mol/K` for self-complementary sequences
- terminal initiation adjustments based on the first and last base

## Concentration model

The Tm core uses the standard duplex form:

```text
Tm(K) = (1000 * deltaH) / (deltaS + R ln(Ct / symmetry_divisor))
```

Where:

- `R = 1.9872 cal/mol/K`
- `Ct` is the oligo concentration in nanomolar units, converted inside the implementation
- the symmetry divisor is `1e9` for self-complementary sequences and `4e9` otherwise

The exported `rawTmCelsius` value is the Kelvin result minus `273.15`.

## Salt correction

The current implementation applies a Primer3-style Owczarzy mixed-salt correction path.

Inputs:

- monovalent concentration in mM
- magnesium concentration in mM
- total dNTP concentration in mM

Implementation details:

- concentrations are clamped to non-negative values
- free magnesium is approximated as `max(magnesium - dNTP, floor)`
- the monovalent/divalent crossover follows the `0.22` ratio threshold in the current code
- the low-divalent branch uses the monovalent correction form
- the higher-divalent branch uses the mixed magnesium correction coefficients implemented in `calculateOwczarzySaltCorrection`

Reported outputs include:

- `saltCorrection`
- `effectiveFreeMagnesiumMolar`
- `divalentToMonovalentRatio`

## DMSO correction

After the salt-corrected duplex temperature is calculated, the current code subtracts:

```text
dmsoPercent * dmsoFactor
```

Default values:

- `dmsoPercent = 0`
- `dmsoFactor = 0.6 C/%`

This is an explicit approximation, not a full solvent model.

## Reported Tm values

The application distinguishes three related temperature outputs:

1. Annealing-body Tm
   Used for the 3 prime template-complementary body of each primer.

2. Full-oligo nominal Tm
   Calculated for the entire primer sequence, including any 5 prime tail.

3. Overlap Tm
   Calculated on the intended overlap duplex introduced by the OE-PCR inner primers.

The first value drives first-stage annealing recommendations.
The second and third values are descriptive and comparative design metrics.

## Default conditions

The current default thermodynamic conditions are:

```text
Monovalent ions: 50 mM
Magnesium: 1.5 mM
dNTP total: 0.2 mM
Oligo concentration: 500 nM
DMSO: 0%
DMSO factor: 0.6 C/%
```

These defaults are defined in `defaultThermodynamicConditions()`.

## Structure model boundary

Secondary-structure calculations are not performed in `src/utils/thermodynamics.ts`.
They are handled separately in `src/utils/structure.ts`.

The current structure layer is a simplified local complement-alignment model that reports:

- hairpins
- homodimers
- heterodimers
- 3 prime dimers

with:

- estimated delta G
- predicted Tm
- stem length
- 3 prime paired bases
- alignment diagrams

This is useful for ranking and warnings, but it is not yet a full loop thermodynamics engine.

## Validation expectations

Current expectations for this layer are:

- stable internal consistency across exports, UI, and protocol calculations
- agreement with external references within documented tolerances for standard DNA oligos

Recommended future work:

- add reference vectors against Primer3 `oligotm`
- document tolerated numeric drift by oligo length and salt regime
- extend the model to explicit mismatch and degenerate-base handling
