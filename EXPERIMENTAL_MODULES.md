# Experimental Modules

FusionPCR Studio `0.1.0-alpha.3` ships a deliberately narrow public MVP.

The modules below still exist in the repository for internal development,
future validation work, or technical review, but they are not part of the
supported public interface and are intentionally hidden behind disabled feature
flags or absent from the public navigation/export surface.

## Hidden from the public MVP

- mutation-oriented sequence rewriting and payload-planning helpers
- broader technical export builders beyond the five public alpha.3 artifacts
- external Primer-BLAST handoff packaging for future genome-scale review
- additional design-comparison and recommendation helpers that remain heuristic
- internal utilities that support insertion, deletion, substitution, or
  domain-swap workflows outside the supported public exact-fusion and
  protein-fusion modes

## Why they remain hidden

- they are outside the scientifically validated two-fragment alpha.3 scope
- they are not covered to the same browser-workflow or release-artifact depth
- several outputs remain heuristic or development-facing rather than public MVP
  deliverables

## Public alpha.3 boundary

The supported public workflows remain limited to:

- exact two-fragment fusion
- protein fusion with an optional short linker or inserted sequence
- four-primer, two-stage OE-PCR planning
- local in-project specificity review
- exact final-product reconstruction
- frame/start/stop checks for protein fusions
- Q5 High-Fidelity and Phusion Plus protocol planning
- the five public exports:
  `project JSON`, `oligo-ordering CSV`, `primer FASTA`,
  `final-construct FASTA`, and `printable protocol`
