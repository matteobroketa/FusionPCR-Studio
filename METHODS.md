# Methods

## Implemented release scope

This repository currently implements a local-first `0.1.0-alpha.3` overlap-extension PCR workflow for two-fragment designs in the browser.

The repository now also contains a Rust workspace that begins the planned split between a browser UI and a reusable computational core. The current Rust side covers sequence normalization, target construction, and basic protocol conversions, while the broader calculation engine still remains primarily in TypeScript.

The application:

- normalizes DNA input to uppercase `A/C/G/T`
- parses plain DNA, FASTA, multi-FASTA, and GenBank records
- lets the user select retained ranges from two source fragments
- supports circular source selections that cross the origin when start and end coordinates wrap around a circular template
- allows an optional inserted DNA payload between the retained ranges
- supports explicit fragment editing operations with lock-aware undo and redo
- supports stage-filtered construct review, pinned-design comparison, and junction-specific inspection
- includes a mutation planner that rewrites a recipient sequence into left and right OE-PCR flanks plus an inserted or replacement payload
- lets the user declare an explicit junction mode
- generates four primers for a two-stage OE-PCR design
- separates 5 prime overlap tails from 3 prime annealing bodies
- calculates nearest-neighbour Tm values under configurable ionic and DMSO conditions
- computes local secondary-structure candidates for hairpins and dimers
- scans local templates for exact 3 prime seed matches and mismatch-weighted off-target candidates
- simulates both first-stage products and the final fusion product
- verifies the simulated final product against the requested target sequence
- emits a starting PCR plan using polymerase profiles plus configurable protocol inputs
- emits stage-specific reagent recipes in addition to mixing and dilution guidance
- exports construct, reporting, and protocol artifacts including FASTA, GenBank, pipetting CSV, thermocycler text, gel sketch, and a calculation manifest
- ranks multiple whole-design primer-body combinations instead of committing only to the single locally best body at each site
- provides frame-aware translation checks for protein-fusion designs
- can search synonymous codon choices near a protein-fusion junction while preserving the amino-acid output
- keeps proposed coding-sequence edits separate from approved edits in the project model

## Authoritative engines

The current repository uses two calculation engines with explicit ownership boundaries.

TypeScript is authoritative for:

- primer-body candidate generation and whole-design ranking
- overlap criteria assessment
- nearest-neighbour thermodynamics as surfaced in the browser runtime
- heuristic secondary-structure analysis
- local specificity scans and unintended-amplicon classification
- protocol-plan assembly beyond the shared scalar unit-conversion helpers
- all browser exports and UI-facing review summaries

Rust is authoritative for the shared cross-language core that is currently implemented in both engines:

- DNA normalization and validation semantics used by `parse_sequence`
- reverse-complement generation
- GC-fraction calculation
- selected-range target construction for exact and approved protein-fusion edits
- scalar protocol unit conversions: `pmol_to_mass_ng`, `mass_ng_to_pmol`, and `volume_for_mass`

Where both engines implement the same calculation, the repository now treats the Rust output as the parity reference and tests the TypeScript mirror against it.

## Primer construction

For retained fragment slices `A` and `B`, the app chooses:

- an outer forward primer body from the start of `A`
- an inner reverse primer body from the end of `A`
- an inner forward primer body from the start of `B`
- an outer reverse primer body from the end of `B`

The inner overlap is constructed as:

```text
overlap = A_body + insert + B_body
```

The inner primers are then:

```text
B_inner_F = A_body + insert + B_body
A_inner_R = reverse_complement(A_body + insert + B_body)
```

This preserves the intended OE-PCR relationship between the two first-stage products.

The current UI now provides a dedicated planner for translating common mutagenesis intents into this engine model:

- insertion mode splits one recipient fragment at a chosen coordinate and inserts payload DNA
- deletion mode removes a selected recipient interval and joins the new adjacency
- substitution mode replaces a selected recipient interval with manual payload DNA
- domain-swap mode uses the same replacement model, optionally sourcing the payload from the donor fragment's selected range

## Sequence import

The import layer currently auto-detects:

- plain DNA sequence
- FASTA
- multi-FASTA
- GenBank

For imported sources, the app records:

- source name
- source format
- topology when available
- checksum
- ambiguous `N` bases
- preserved GenBank feature labels and raw locations
- simple imported feature ranges can be applied directly to fragment selection coordinates, including supported circular origin-wrap joins

Unsupported ambiguity symbols beyond `N` are rejected explicitly.

## Local specificity

The current local specificity layer analyzes:

- imported fragment sequences
- their reverse complements
- simulated PCR 1A and PCR 1B products
- the simulated final fusion product

For each primer body, the app:

- searches exact 3 prime seed matches
- extends them to the full annealing body
- scores mismatch burden with a stronger penalty near the 3 prime end
- flags strong extra sites as watch or high risk
- tests risky forward/reverse site pairs for unintended amplicons

This is a local heuristic screen, not a genome-scale specificity search.

## Hidden external specificity handoff module

The repository still contains a local handoff generator for experimental external review, but it is not part of the public alpha.3 MVP surface.

The hidden module can record:

- target organism
- selected database
- handoff notes

It can export a Primer-BLAST handoff package containing:

- disclosure that sequences will leave the browser when submitted externally
- stage-specific intended primer pairs
- expected amplicon lengths
- project context and local-specificity summary
- the Primer-BLAST entry URL plus manual submission steps

## Body selection

The current implementation scans candidate annealing bodies within the selected polymerase profile bounds:

- `Q5 High-Fidelity`: 20 to 40 nt
- `Phusion Plus`: 18 to 35 nt
- global hard floor: 12 nt
- global hard ceiling: 40 nt

Every candidate is rejected when:

- the selected fragment range is shorter than the profile minimum
- nearest-neighbour thermodynamic outputs are non-finite
- the candidate cannot satisfy the required template-anchored orientation

Remaining candidates are ranked by:

- nearest-neighbour body Tm distance from the polymerase target
- GC percentage distance from the preferred 40 to 60 percent range
- lack of a terminal G/C clamp
- homopolymer burden above 4 identical bases
- deviation from the profile-preferred length window

This is still a bounded heuristic selector rather than an exhaustive global search.

## Overlap criteria

The release no longer scores overlaps by proximity to a single target Tm. Instead, every proposed overlap is assessed against separately documented OE-PCR operating criteria:

- overlap Tm between 58 C and 72 C
- overlap length at least 24 nt
- overlap GC between 35% and 65%
- homopolymer run no longer than 4 bases
- finite thermodynamic output for the full overlap duplex

The overlap contribution to design ranking is derived from the fraction of these criteria that pass.
Warnings cite the exact failed criterion rather than reporting only a scalar overlap-Tm score.

The current optimizer layer then:

- keeps the top few body candidates for each required primer
- evaluates a bounded set of whole-design combinations
- scores each complete design by Tm balance, body-fit quality, overlap-criteria compliance, structure risk, specificity risk, and synthesis burden
- returns ranked alternatives for balanced, lower-dimer, shorter-oligo, and higher-overlap priorities

## Thermodynamics and structure

The current release uses:

- SantaLucia nearest-neighbour duplex enthalpy and entropy parameters
- Primer3-style Owczarzy mixed-salt correction logic
- configurable monovalent ion, magnesium, dNTP, oligo concentration, and DMSO inputs
- separate reporting of annealing-body Tm, full-oligo nominal Tm, and overlap Tm
- simple GC percentage
- local-alignment-based hairpin, homodimer, heterodimer, and 3 prime dimer candidates
- estimated delta G, predicted Tm, base-pair count, longest contiguous stem, terminal pairing counts, and alignment diagrams

The salt and DMSO path is intended to approximate the Primer3 `oligotm` calculation for standard DNA oligos.
The secondary-structure layer uses a simplified local complement-alignment model rather than a full loop-and-bulge thermodynamic search.

## Reaction planning

Starting PCR conditions are derived from simple built-in profiles:

- `Q5`: annealing starts around lower body Tm plus 3 C
- `Phusion Plus`: annealing starts at the higher of 60 C or the lower body Tm

Extension time is estimated from product length and profile-specific seconds per kilobase with a minimum extension floor.

The protocol layer also calculates:

- stage-product mass from target pmol and product length
- required stage-product volume from measured concentration
- equimolar, user-defined, or limiting-fragment mixing strategies
- primer working-stock preparation from stock and working concentrations
- total primer working volume required across stage and final reactions
- total master-mix volume with overfill allowance
- user-editable stage and final cycle counts
- per-reaction and total setup volumes for profile-aware reaction recipes

The current recipe layer supports:

- `Q5` as a simplified 2x reaction-mix workflow plus separate primers, templates, optional DMSO, and water
- `Phusion Plus` as a separate-component workflow with 5x buffer, dNTP mix, polymerase, primers, templates, optional DMSO, and water
- explicit stage 1 source-template loading
- explicit fusion-stage loading of PCR 1A and PCR 1B products based on the computed stage-mix targets

## Public export package

The public alpha.3 export layer emits:

- oligo-ordering CSV
- primer FASTA
- final-construct FASTA
- printable protocol text
- project JSON

The repository also still contains hidden technical export builders for staged products, GenBank, pipetting tables, reports, and calculation manifests.

The GenBank export is intentionally conservative.
It always annotates fragment-contribution spans and any inserted payload.
Imported GenBank features are remapped only when their source locations are simple in-range intervals and the effective selected fragment length is unchanged in the final construct.
More complex or length-changing cases remain summarized in export comments instead of being assigned potentially incorrect coordinates.

## Protein-fusion validation

When the project is in `protein-fusion` mode, the app also:

- tracks upstream and downstream coding frames
- optionally removes a retained terminal stop codon from the upstream coding product
- optionally removes an initial downstream `ATG` from the fused coding product
- translates the upstream, insert, downstream, and fused coding sequences
- checks frame continuity at the junction
- warns about retained start or stop codons and premature termination

If `preserveProtein` is enabled with `flexibleCodons > 0`, the app also:

- examines the last and first in-frame codons near the junction
- enumerates synonymous codon choices with a bounded beam search
- scores candidates by inner-primer body quality, overlap-criteria compliance, GC balance, and homopolymer burden
- applies only candidates that improve the junction-design score while preserving the translated protein
- reports each codon-level nucleotide change in the UI and protocol export

Start/stop removals and synonymous codon substitutions are handled as explicit proposals.
The engine now:

- derives proposed removals or substitutions from the current coding intent
- records approval state in the saved project model
- applies only the approved subset to the effective design sequence
- keeps pending proposals visible in the UI and plain-text export

## UI review model

The current workspace also adds a review layer on top of the design engine:

- a workflow stage selector for overview, `PCR 1A`, `PCR 1B`, `Fusion PCR`, and verification
- toggleable canvas tracks for fragments, construct, primers, GC/Tm, stage products, translation, features, and risk summaries
- a junction inspector that shows upstream, inserted, and downstream sequence provenance plus the annealing and tailed contributions of the inner primers
- a pinned comparison snapshot that summarizes total oligo length, worst pairwise dimer, primer Tm spread, overlap Tm, and local off-target counts
