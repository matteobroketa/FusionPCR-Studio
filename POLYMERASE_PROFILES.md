# Polymerase Profiles

This document records how polymerase-specific defaults are currently represented in FusionPCR Studio.

## Current implementation

The active profile model lives in `src/utils/fusion.ts`:

```ts
type PolymeraseProfile = {
  id: 'q5' | 'phusion_plus';
  label: string;
  targetBodyTm: number;
  secondsPerKb: number;
  minExtensionSeconds: number;
  gradientSpan: number;
  annealingTemperature: (lowerPrimerBodyTm: number) => number;
};
```

The current protocol recipe layer adds separate setup-specific data in `src/utils/protocol.ts`.

That layer records whether a workflow is:

- a 2x master-mix setup
- a buffer + dNTP + polymerase component setup

## Implemented profiles

### `q5`

Current values:

```text
Label: Q5 High-Fidelity
Target annealing-body Tm: 64 C
Extension rate: 15 s/kb
Minimum extension: 10 s
Suggested gradient span: 3 C
Annealing rule: round(lower primer body Tm + 3 C)
Recipe style: 2x Q5 reaction mix
```

### `phusion_plus`

Current values:

```text
Label: Phusion Plus
Target annealing-body Tm: 62 C
Extension rate: 20 s/kb
Minimum extension: 15 s
Suggested gradient span: 4 C
Annealing rule: round(max(60 C, lower primer body Tm))
Recipe style: 5x buffer + dNTP mix + polymerase
```

## How the profiles are used

The current app uses polymerase profiles in four places:

1. Primer-body ranking
   `targetBodyTm` biases candidate body selection.

2. Reaction recommendations
   `annealingTemperature()` converts the lower primer-body Tm into a suggested starting annealing temperature.

3. Extension-time planning
   `secondsPerKb` and `minExtensionSeconds` determine stage-specific extension times.

4. Exported protocols and recipes
   The chosen profile affects protocol text, pipetting tables, and thermocycler-program exports.

## Separation between design and recipe data

The repository currently stores:

- primer-design profile behavior in `polymeraseProfiles`
- wet-setup recipe behavior in the `RECIPE_PROFILES` table inside `src/utils/protocol.ts`

This is enough for the current release but is not yet the fully versioned data-file system described in the build plan.

## Versioning boundary

The build plan calls for versioned profile data files rather than scattered constants.
The current repository has not completed that refactor yet.

Current limitations:

- profile constants are still embedded in source
- there is no external profile manifest format
- there is no historical profile version selection in saved projects

Recommended next step:

- move both `polymeraseProfiles` and `RECIPE_PROFILES` into versioned JSON or TypeScript data modules with explicit provenance notes
- record a profile version string in the saved project format

## Practical interpretation

The profile values are intended to provide a reproducible starting point for OE-PCR planning.
They are not guarantees of optimal wet-lab performance.

Users should still adjust:

- annealing gradients
- extension times
- additive use
- template loading
- cycle counts

based on template complexity, GC burden, and observed gel results.
