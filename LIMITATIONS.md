# Limitations

This release intentionally does not implement the full scientific scope described in `buildplan.md`.

## Current technical limits

- Rust workspace and WASM bindings are scaffolded, but the full calculation engine is not yet ported from TypeScript
- No whole-genome specificity search
- No Primer3 integration
- No multi-fragment global optimization
- No wet-lab validation dataset

## Current biological limits

- Two fragments only
- Insert payloads are supported, but the mutation planner still targets one recipient sequence at a time rather than arbitrary construct-library editing
- Synonymous optimization is local to the junction window and is not yet a global codon-usage or synthesis-constraint optimizer
- Mutation review is explicit for coding-sequence proposals, but there is not yet a dedicated multi-edit mutation planner for arbitrary construct libraries
- Domain swapping is currently implemented through the same two-flank replacement workflow and does not yet model larger multi-junction swap assemblies
- The current construct canvas is stage-aware and selectable, but it still does not implement free pan/zoom, drag-and-drop fragment assembly, or true base-level graphical editing
- Primer bodies are chosen heuristically rather than by full thermodynamic optimization
- Whole-design optimization is currently bounded to a small candidate beam for the two-fragment workflow; it is not yet the multi-fragment global optimizer described in the plan
- Structure checks are simplified contiguous-run heuristics
- Reaction planning is a starting recommendation, not a validated protocol promise
- Imported GenBank features can drive simple or origin-wrap range selection, but they still do not support full feature-aware construct editing, strand-aware remapping, or arbitrary complex joins
- Circular origin-crossing selections are supported during design, but circular editing operations and feature remapping remain limited
- Secondary-structure scoring is still simplified and does not yet implement full loop/bulge-constrained thermodynamic folding
- Thermodynamics currently target standard perfectly matched DNA duplexes only
- Specificity includes a Primer-BLAST handoff package, but the application still does not execute genome-scale searches or return external results directly
- Protocol recipes are profile-aware but still use simplified reagent assumptions rather than manufacturer-complete buffer systems for every polymerase variant

## Intended use

Use the current app as a local-first construct planner and OE-PCR sketchpad.

Do not treat it as a substitute for:

- full oligo thermodynamic analysis
- off-target specificity analysis
- polymerase-manufacturer protocol review
- experimental validation
