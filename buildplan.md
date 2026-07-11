# Proposed project: FusionPCR Studio

**Repository:** `fusion-pcr-studio`
**Public title:** **FusionPCR Studio**
**Tagline:** *Visual design, validation and protocol planning for overlap-extension PCR.*

The application should let a researcher visually assemble DNA fragments, mutations, linkers and tags; automatically design the required primers; explain why each primer was chosen; calculate reaction conditions; and export a complete experimental package.

The strongest implementation is a **local-first browser application**. Sequence data and calculations remain in the browser, while a Rust/WebAssembly calculation engine performs primer search, thermodynamics, secondary-structure analysis and global optimization. The core application can therefore be hosted on GitHub Pages without a server. An optional online service can later provide genomic specificity searches.

Overlap-extension PCR works by producing first-stage amplicons with complementary ends. Those ends anneal in a subsequent reaction, their 3′ ends prime extension, and outer primers amplify the completed fusion product. This permits precise fusion, insertion, deletion and mutagenesis without relying on restriction sites. ([PubMed][1])

---

# 1. What the application should do

FusionPCR Studio should support six primary design modes.

## Exact fragment fusion

Join two or more fragments in a specified order without altering their sequences.

Example:

```text
Promoter + coding sequence + fluorescent tag + terminator
```

## Protein fusion

Join coding sequences while preserving reading frame, optionally inserting a linker and removing an upstream stop codon or downstream start codon.

Example:

```text
Protein A + GGGGS linker + GFP
```

## Site-directed mutagenesis

Introduce one or more substitutions into a product using an overlap that contains the desired altered bases.

## Insertion

Insert a tag, linker, restriction site, barcode or other short sequence at a selected coordinate.

## Deletion

Remove a selected range and design the overlap around the newly adjacent sequence.

## Domain swapping

Replace one region with a homologous or heterologous fragment while preserving the remainder of the construct.

Later releases can add:

* Degenerate codons
* Saturation mutagenesis
* Hierarchical assembly of many fragments
* Batch design of construct libraries
* Protein-preserving synonymous junction optimization
* Vector-linearization primers
* Gibson-ready terminal homology
* Multiplex and one-pot OE-PCR modes

The first release should remain focused on **two- and three-fragment, two-stage OE-PCR**. It should not initially attempt to become a complete cloning platform.

---

# 2. The central visual concept

The application should be organized around a **construct canvas**, not a traditional primer-design form.

The user should see:

```text
SOURCE FRAGMENTS
┌──────────── Fragment A ────────────┐
                       ┌──────── Fragment B ────────┐

TARGET CONSTRUCT
┌──────────── A ────────────┬──────── B ───────────┐
                             ↑
                          Junction 1

PRIMERS
A outer F  ───────▶
A inner R                         ◀────────────
B inner F                         ────────────▶
B outer R                                           ◀──────
```

At low zoom, the canvas shows whole fragments and junctions. At high zoom, it shows individual bases, primer bodies, overlap tails, edits and translated amino acids.

## Required visual layers

The central canvas should support independently toggleable tracks:

* Source fragments
* Final assembled construct
* Primer positions
* 5′ overlap tails
* 3′ template-binding regions
* Intended fusion overlaps
* Annotated biological features
* Reading frames and translation
* Local GC percentage
* Predicted local melting behavior
* Repetitive sequence
* Potential off-target sites
* Hairpin and dimer interactions
* Expected first-stage PCR products
* Expected final product

Each fragment should retain a stable visual identity across every screen. The same fragment should look recognizably identical in the source list, target construct, reaction diagram and exported report.

## Junction visualization

A junction should be represented as a selectable node between fragments.

Selecting it should open a detailed junction inspector containing:

```text
Upstream sequence:      ...GACCTGATCG
Inserted sequence:         GGTGGCGGT
Downstream sequence:            ATGACCTAC...

Final junction:
...GACCTGATCGGGTGGCGGTATGACCTAC...
             └──── overlap ────┘
```

The inspector should make the following distinctions unambiguous:

* Bases originating from the upstream fragment
* Bases originating from the downstream fragment
* Newly inserted or mutated bases
* Bases used as the 3′ annealing region of each primer
* Bases present only as a 5′ non-annealing tail in the first PCR

This distinction is essential. For tailed primers, the initial PCR annealing temperature must be calculated from the **3′ template-complementary portion**, not from the entire oligonucleotide. The entire oligo still matters for synthesis quality, hairpins and primer–primer interactions.

---

# 3. Recommended user workflow

## Step 1: Start a project

The opening screen should offer:

```text
New exact fusion
New protein fusion
New insertion
New deletion
New mutation
Open saved project
Load example
```

An example project should be immediately available so users can understand the interface without entering sequences.

## Step 2: Import sequences

Accepted formats:

* Plain DNA sequence
* FASTA
* GenBank
* Multi-FASTA
* Application project JSON

For every imported sequence, show:

* Name
* Length
* Linear or circular topology
* GC percentage
* Detected features
* Ambiguous bases
* Reverse-complement control
* Sequence checksum

GenBank features should be preserved and mapped into the final construct.

The parser must reject or explicitly handle:

* Invalid characters
* Protein sequences pasted into DNA fields
* Empty sequences
* Conflicting coordinates
* Unsupported ambiguity symbols
* Duplicate sequence names
* Circular coordinates crossing the origin

## Step 3: Compose the target

Users should drag fragments onto the target construct or select ranges from source sequences.

Operations should include:

* Reverse-complement
* Trim left or right
* Extract coordinates
* Split
* Duplicate
* Insert sequence
* Delete region
* Replace region
* Add linker
* Add tag
* Lock fragment

The final desired DNA sequence must always be explicit. The primer engine should design a route to that target rather than allowing the design algorithm to silently alter the target.

## Step 4: Define biological intent

For each junction, ask whether it is:

* Exact DNA fusion
* Protein fusion
* Mutation
* Insertion
* Deletion
* Flexible protein-preserving junction

For coding sequences, ask for:

* Coding frame
* Whether the upstream stop codon should be retained
* Whether the downstream start codon should be retained
* Whether a linker is required
* Whether synonymous changes are allowed
* Whether restriction sites or motifs must be avoided

## Step 5: Select reaction conditions

The user should select a polymerase profile rather than manually entering every condition.

Initial profiles could include:

* Generic high-fidelity polymerase
* Q5 High-Fidelity
* Q5 master mix
* Phusion Plus
* Custom profile

Profiles should be versioned data files, not scattered constants in source code.

A profile should define:

```text
Primer length range
Preferred annealing-region Tm
Allowed primer-pair Tm difference
GC range
Salt and magnesium conditions
dNTP concentration
Primer concentration
DMSO treatment
Annealing-temperature rule
Extension temperature
Seconds per kilobase
Cycle recommendations
Two-step cycling rules
Maximum recommended amplicon length
```

For example, current Q5 guidance generally uses 20–40-nucleotide primers with 40–60% GC, calculates annealing using Q5-specific conditions, and commonly starts around 3°C above the lower primer Tm. Extension time varies with template complexity. Phusion Plus currently recommends 18–35-nucleotide primers, 40–60% GC, and commonly uses 15–30 seconds per kilobase depending on template complexity. These values must be stored in versioned profiles because manufacturer guidance can change. ([NEB][2])

## Step 6: Optimize

The application generates multiple complete designs rather than one unexplained answer.

The results screen should present:

```text
Recommended design
Alternative 1: shorter oligos
Alternative 2: better secondary structure
Alternative 3: higher overlap Tm
Alternative 4: moved flexible junction
```

The user should be able to lock any primer, overlap or junction and rerun optimization around the locked decisions.

## Step 7: Review reactions

Show a reaction timeline:

```text
PCR 1A       PCR 1B       Cleanup       Fusion       Final PCR
Fragment A   Fragment B    Equimolar     Overlap      Outer primers
```

Each step should display:

* Inputs
* Expected product
* Product length
* Primer pair
* Annealing temperature
* Extension time
* Reaction volume
* Expected gel band
* Cleanup or dilution step
* Warnings

## Step 8: Export

The project should export:

* Oligo-ordering CSV
* Primer FASTA
* Final construct FASTA
* Annotated GenBank
* First-stage amplicon FASTA
* Complete project JSON
* Printable protocol
* Pipetting table
* Thermocycler program
* Junction report
* Validation report
* Expected gel diagram
* Methods and calculation manifest

---

# 4. Primer construction logic

For a junction between upstream fragment `A` and downstream fragment `B`, define:

```text
A_body = terminal annealing sequence from A
B_body = initial annealing sequence from B
I      = inserted or replacement sequence
J      = A_body + I + B_body
```

The inner primers are then:

```text
Forward inner primer for B = J
Reverse inner primer for A = reverse_complement(J)
```

The 3′ end of the forward inner primer anneals to `B`.

The 3′ end of the reverse inner primer anneals to `A`.

The remaining 5′ portions add the desired overlap, insertion or mutation during the first-stage reactions.

For an exact fusion:

```text
I = empty
```

For an insertion:

```text
I = inserted DNA
```

For a deletion, the selected source ranges omit the deleted region and the engine designs the junction between the newly adjacent boundaries.

For a substitution, the desired changed sequence is encoded in the junction while retaining sufficiently strong perfect-match 3′ annealing regions.

## Important internal-primer exception

The two inner primers are deliberately highly complementary. A normal primer-design program may classify them as an unacceptable heterodimer pair.

FusionPCR Studio must understand that:

* They are intentionally complementary.
* They are normally used in separate first-stage reactions.
* Their complementarity is the mechanism that creates the shared overlap.
* They should not be scored as if they were an ordinary primer pair used together.

The engine should still warn when the protocol places them in the same reaction, particularly in an advanced one-pot design.

---

# 5. Candidate generation

For every required primer, the engine should enumerate possible 3′ annealing regions.

A configurable initial search range could be:

```text
Minimum annealing body: 16 nt
Preferred range:        18–30 nt
Maximum:                40 nt
```

These are search limits, not universal biological laws. The preferred range should come from the selected polymerase profile.

For each candidate, calculate:

* Annealing-region length
* Entire oligo length
* Annealing-region Tm
* Entire-oligo nominal Tm
* GC percentage
* 3′ GC content
* 3′ terminal stability
* Homopolymer length
* Dinucleotide repeats
* Low-complexity score
* Hairpin strength
* Self-dimer strength
* Heterodimer strength
* 3′-anchored dimer strength
* Local-template uniqueness
* Whole-input-project uniqueness
* Optional genomic specificity
* Synthesis-complexity warnings
* Junction-overlap Tm
* Primer-pair Tm difference

Primer3 considers Tm, size, GC content, primer-dimer formation, product size, position and ectopic priming, and its thermodynamic mode evaluates oligo–oligo and hairpin interactions. FusionPCR Studio should cover at least the equivalent conceptual categories while adding OE-PCR-specific overlap logic. ([Primer3][3])

---

# 6. Melting-temperature calculations

## Use nearest-neighbour thermodynamics

Do not use only the Wallace rule or a simple GC formula for design ranking.

For a perfectly complementary duplex, calculate total enthalpy and entropy from nearest-neighbour dinucleotide parameters, terminal corrections and symmetry corrections.

The principal form is:

```text
Tm(K) = ΔH / [ΔSsalt + R ln(Ct / 4)]
Tm(°C) = Tm(K) − 273.15
```

Where:

* `ΔH` is duplex enthalpy
* `ΔSsalt` is salt-corrected entropy
* `R` is the gas constant
* `Ct` is the effective oligo concentration

When using kcal/mol for `ΔH`, multiply it by 1,000 before combining it with entropy in cal/mol/K.

For the SantaLucia monovalent correction:

```text
ΔSsalt = ΔS + 0.368 × (N − 1) × ln([Mon+])
```

where `N` is sequence length and the salt concentration is in molar units. Primer3 documents this formulation and recommends SantaLucia nearest-neighbour parameters as its modern default. ([PubMed][4])

## Magnesium and dNTP correction

The calculation must accept:

* Monovalent ion concentration
* Magnesium concentration
* Total dNTP concentration
* Oligo concentration
* DMSO percentage

Magnesium cannot simply be added to sodium concentration. Some magnesium is complexed by dNTPs, and mixed monovalent/divalent conditions require an appropriate model. Implement the Owczarzy correction scheme with test vectors rather than inventing a new approximation. Primer3 supports this model and explicitly considers Mg²⁺ and dNTP concentrations. ([PubMed][5])

## DMSO correction

Support an optional DMSO adjustment as a separately identified approximation.

Primer3 uses:

```text
Tmcorrected = Tm − factor × DMSO%
```

with a configurable default factor. The UI should identify the chosen coefficient and source rather than presenting it as exact. ([Primer3][6])

## Three different Tm values

For every tailed primer, display three values:

### Annealing-body Tm

Calculated only from the 3′ region complementary to the original template.

This determines first-stage PCR annealing behavior.

### Full-oligo nominal Tm

Calculated for the entire oligo as if fully paired.

This is mainly descriptive for a tailed primer and should not drive the first-stage annealing recommendation.

### Overlap Tm

Calculated for the shared duplex between completed first-stage amplicons.

This describes overlap stability during the fusion phase.

The overlap Tm should be presented as a **comparative design metric**, not a guaranteed fusion temperature. Effective amplicon concentration changes during PCR and is not generally known precisely.

---

# 7. Secondary-structure calculations

The calculation engine should evaluate:

* Hairpins
* Self-dimers
* Heterodimers
* 3′ self-dimers
* 3′ heterodimers
* Intended inner-primer complementarity
* Cross-dimers among all primers in a multi-fragment project

## Required outputs

For every predicted structure, return:

```text
ΔG
Predicted Tm
Base-pair count
Longest contiguous stem
Number of paired 3′ terminal bases
Alignment diagram
Coordinates in each oligo
```

Example:

```text
Primer A
5′ GACTGACCTGATCGTACG 3′
               |||||
3′             GCATG... 5′
                ↑
          Extendable 3′ interaction
```

A 3′-anchored interaction should receive a larger penalty than an equivalent internal interaction because it can produce an extendable primer dimer.

IDT currently uses approximately −9 kcal/mol as a practical warning threshold for strong self- and heterodimer structures and recommends that hairpin Tm remain below the oligo’s operating temperature. This should be a configurable warning baseline, not a universal pass/fail rule. ([IDT DNA][7])

## Implementation approach

Use dynamic programming to find thermodynamically favorable structures under allowed loop and bulge constraints.

Separate calculations into:

```text
hairpin(sequence)
homodimer(sequence)
heterodimer(sequence_a, sequence_b)
three_prime_dimer(sequence_a, sequence_b)
```

For long oligos, prune clearly impossible alignments and execute the calculation in a Web Worker so the UI remains responsive.

---

# 8. Specificity analysis

Specificity should have two levels.

## Local specificity

This always runs locally against:

* Every imported template
* Reverse complements
* The final construct
* All first-stage products

For each 3′ annealing region:

1. Search for exact 3′ seeds.
2. Extend candidate matches using alignment.
3. Score mismatches by position.
4. Penalize mismatches near the 5′ end less severely.
5. Treat a strong match at the 3′ end as high risk.
6. Test whether any pair of off-target sites has the orientation and distance required to create an unintended amplicon.

The output should not merely say “multiple matches.” It should show the actual sites and predicted products.

## Genomic specificity

This should be optional because it requires an external sequence database.

Two implementation choices:

### Simple first release

Generate a properly formatted Primer-BLAST submission package and provide instructions or a direct handoff.

### Later online service

Submit a search through a controlled API service and return results to the application.

The user must explicitly choose an organism and database. NCBI recommends using the smallest relevant database where possible, and Primer-BLAST combines primer design with BLAST-based specificity checking, including different primer-pair combinations. ([NCBI][8])

The application should clearly disclose when sequences leave the browser.

---

# 9. Biological and coding-sequence validation

For coding sequences, calculate and display:

* Reading frame
* Protein translation
* Stop codons
* Start codons
* Junction codons
* Linker translation
* Protein length
* Amino-acid sequence around each junction
* Frame shifts
* Unintended amino-acid changes

The basic frame condition is:

```text
(coding_bases_before_junction + inserted_bases) mod 3 = expected_frame
```

Warnings should include:

```text
Frameshift: the inserted sequence has 8 bases.
Add or remove 1 base to preserve the current reading frame.
```

```text
Premature termination: the upstream fragment retains its stop codon.
Remove TGA to create a continuous C-terminal fusion.
```

```text
Unexpected N-terminal methionine: the downstream ATG is retained.
```

Do not automatically remove start or stop codons. Present the result and require the user to approve the change.

## Protein-preserving optimization

An advanced mode should permit synonymous changes near a fusion junction.

The user specifies:

```text
Protein sequence must remain unchanged
Synonymous changes allowed within ±4 codons of the junction
```

The engine then searches synonymous codon combinations to improve:

* Overlap Tm
* GC balance
* Repeat content
* Hairpin risk
* Primer length
* Synthesis complexity

Use beam search rather than enumerating every possible synonymous combination.

Every proposed nucleotide change must be visible and individually reversible.

---

# 10. Reaction calculations

## Amplicon length

Calculate each first-stage product directly by simulating primer extension against the selected template.

The result must include added 5′ tails.

```text
product_length =
template_region_length
+ forward_5prime_tail_length
+ reverse_5prime_tail_length
```

## Final product

Reconstruct the complete final product from the first-stage products and their intended overlap.

Then verify:

```text
simulated_final_product == requested_target_sequence
```

If this test fails, the design must be rejected.

## DNA mass and molarity

Use an explicitly labeled average molecular weight for double-stranded DNA:

```text
pmol = mass_ng × 1000 / (length_bp × 660)
```

Rearranged:

```text
mass_ng = pmol × length_bp × 660 / 1000
```

Volume from a measured concentration is:

```text
volume_µL = required_mass_ng / concentration_ng_per_µL
```

The application should calculate equimolar fragment mixing and allow:

* 1:1 molar ratio
* User-defined ratios
* Limiting-fragment strategy
* Total target DNA input

Avoid predicting PCR yield from sequence alone. It is not reliable enough to present as a quantitative promise.

## Primer dilution

For stock and working concentrations:

```text
C1 × V1 = C2 × V2
```

Generate:

* Working-stock preparation
* Primer volume per reaction
* Master-mix quantities
* Overfill allowance
* Number of reactions
* Total required oligo volume

## Annealing temperature

The recommendation must be polymerase-profile-specific.

For Q5, the current manufacturer starting rule commonly uses a 10–30-second annealing step around 3°C above the lower primer Tm and recommends a gradient when necessary. Q5 extension is commonly approximately 10 seconds/kb for simple templates and 20–30 seconds/kb for complex templates. Phusion Plus currently uses a 60°C starting annealing condition for many primers and approximately 15–30 seconds/kb depending on template complexity. ([NEB][9])

The engine should therefore define:

```text
Ta = polymerase_profile.annealing_rule(lower_primer_body_tm)
```

It should never calculate initial annealing from the entire tailed primer.

## Extension time

```text
extension_seconds =
ceil(product_length_bp / 1000 × profile.seconds_per_kb)
```

Apply a profile-defined minimum time.

Use the full final product length for the final amplification stage.

## Cycle counts

Cycle recommendations should come from polymerase profiles and remain user-editable.

Do not attempt to infer a precise optimal cycle number from primer sequence. Instead, consider:

* Template type
* Starting template amount
* First-stage versus final PCR
* Product length
* Whether the product will be cloned or only visualized
* Risk of error accumulation

## Gradient recommendation

When design margins are narrow, recommend a gradient centered around the profile-calculated annealing temperature.

Show:

```text
Suggested gradient: 61–67°C
Center: 64°C
Reason: the two primer bodies differ by 3.8°C and one has a secondary-structure warning.
```

---

# 11. Multi-fragment optimization

Designing each junction independently is insufficient for projects with several fragments.

The engine must consider the complete primer collection.

## Global optimization procedure

### Stage 1: Generate local candidates

Generate the top 20–100 candidates for every primer and junction.

### Stage 2: Build compatibility matrices

Calculate:

* Pairwise cross-dimer scores
* Tm compatibility
* Shared 3′ seeds
* Unintended overlap compatibility
* Similarity between primers
* Potential cross-amplification

### Stage 3: Search complete designs

Use beam search or integer optimization to choose one candidate per primer while minimizing the complete design penalty.

### Stage 4: Return a Pareto set

Return designs optimized for different priorities:

* Highest overall quality
* Shortest oligos
* Lowest secondary-structure risk
* Most uniform PCR conditions
* Fewest total reactions
* Lowest estimated synthesis complexity

## Hierarchical assembly planning

For many fragments, the engine should compare:

```text
One-stage fusion of all fragments
Sequential left-to-right fusion
Balanced binary assembly
User-defined grouping
```

A balanced strategy might look like:

```text
A + B → AB
C + D → CD
AB + CD → ABCD
```

Score assembly plans based on:

* Number of reactions
* Number of primers
* Longest intermediate product
* Weakest overlap
* Fragment-size imbalance
* Total handling steps
* Compatibility of reaction conditions

Do not claim that the mathematically highest score guarantees the highest wet-lab success. Label it as an optimization recommendation.

---

# 12. Design scoring

Do not report an invented “92% chance of success.”

Instead, report a transparent **design quality score**.

Use component scores:

```text
Annealing quality
Overlap quality
Secondary-structure quality
Specificity
Synthesis quality
Protocol compatibility
Biological correctness
```

A weighted geometric mean works well because one severe weakness should substantially lower the total:

```text
Q = 100 × ∏(qi / 100)^wi
```

Where:

* `qi` is each component score
* `wi` is its normalized weight
* Sum of all weights equals 1

Hard failures override the score:

* Wrong assembled sequence
* Non-complementary intended overlap
* 3′ mismatch to the intended template
* Impossible frame
* Ambiguous 3′ base
* Missing primer
* Duplicate primer names
* Product outside permitted length
* Unresolvable off-target product

Display the score breakdown:

```text
Overall: 83 / 100 — Good design

Annealing              94
Overlap                91
Secondary structure    67
Specificity            88
Synthesis              76
Protocol compatibility 92
Biological correctness 100
```

Every deduction should be inspectable.

---

# 13. Recommendation system

Recommendations should have four levels:

```text
Information
Suggestion
Warning
Blocking error
```

Every message should answer:

1. What was detected?
2. Why does it matter?
3. What can the user do?
4. Will the engine alter the design automatically?

Example:

```text
Warning: strong 3′ self-dimer predicted for primer B_F.

Why it matters:
The final five bases can form an extendable duplex with another copy
of the primer.

Possible actions:
• Increase the annealing body from 21 to 24 bases.
• Shift the primer start 3 bases downstream.
• Use Alternative Design 2.

No sequence changes have been applied.
```

Other recommendations should cover:

* Low or high GC
* Long homopolymers
* Repetitive 3′ sequence
* Large primer Tm difference
* Weak overlap
* Very long oligo
* Long inserted sequence
* High-GC amplicon
* Long amplicon
* Multiple local binding sites
* Frame shift
* Unexpected stop codon
* Intentionally complementary inner primers used together
* Unbalanced fragment molarity
* Ambiguous template bases
* Need for a temperature gradient
* Need for a synthetic bridge fragment

## Synthetic-fragment recommendation

If a design produces very long internal primers or a large insertion, the engine should recommend alternatives:

```text
The required inner primers are 118 and 121 bases long.

Consider:
• A synthetic double-stranded bridge fragment
• Dividing the insertion into a separate fragment
• A hierarchical assembly
• Moving the junction within the permitted window
```

The thresholds should be configurable because synthesis capabilities vary.

---

# 14. UI layout

A desktop workspace should use four main regions.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Project | Undo | Polymerase | Optimize | Compare | Export        │
├──────────────┬─────────────────────────────────┬─────────────────┤
│ Fragments    │ Construct and sequence canvas   │ Inspector       │
│              │                                 │                 │
│ A            │ A ─────────┬──────── B          │ Junction 1      │
│ B            │            ↑                    │ Candidate       │
│ Linker       │          overlap                │ Risks           │
│              │                                 │ Calculations    │
├──────────────┴─────────────────────────────────┴─────────────────┤
│ PCR 1A → PCR 1B → Cleanup → Fusion → Final PCR → Verification   │
└──────────────────────────────────────────────────────────────────┘
```

## Left panel: project materials

Contains:

* Source fragments
* Tags and linkers
* Saved sequences
* Operations
* Target-product outline

## Centre: construct canvas

Supports:

* Pan and zoom
* Base-level selection
* Dragging fragments
* Junction editing
* Primer overlays
* Feature tracks
* Translation
* Risk highlighting

## Right panel: inspector

Changes based on selection:

* Fragment inspector
* Junction inspector
* Primer inspector
* Reaction inspector
* Warning inspector

## Bottom panel: workflow

Shows the experimental sequence and expected products.

Selecting a stage should filter the canvas to the primers and products involved in that stage.

---

# 15. UX requirements

## Never hide sequence changes

Any mutation, codon change, linker insertion or start/stop removal must be shown before acceptance.

## Preserve user intent

Automatic optimization may adjust primer length and placement. It may not change the target construct unless the user has enabled a flexible mode.

## Undo and redo

Every editing operation must be reversible.

## Locking

Users must be able to lock:

* Fragment boundaries
* Junction position
* Inserted sequence
* Annealing body
* Complete primer
* Polymerase settings

## Compare mode

Allow side-by-side comparison of complete designs.

```text
                 Design A     Design B
Total oligo nt      172          188
Worst dimer ΔG     −7.2         −5.1
Tm spread           2.4°C        1.1°C
Overlap Tm         67.8°C       71.2°C
Local off-targets     0            0
```

## Progressive complexity

The default interface should show:

* Construct
* Primers
* Main warnings
* Recommended protocol

An advanced toggle should reveal:

* Ionic conditions
* Thermodynamic model
* Weighting parameters
* Full structures
* Candidate-generation limits
* All scoring terms

## Accessibility

Requirements:

* No meaning communicated by color alone
* Patterns or icons for fragment types
* Keyboard navigation
* Visible focus states
* Screen-reader labels
* Sufficient contrast
* Scalable text
* Text alternatives for interaction diagrams
* Exportable plain-text calculations

## Mobile support

A phone layout may support reviewing and exporting a saved design. Full drag-and-drop sequence construction should be optimized for desktop and tablet.

---

# 16. Technical architecture

## Recommended stack

```text
Frontend:
TypeScript
React
Vite
SVG-based construct renderer

Calculation engine:
Rust
Compiled to WebAssembly

Background execution:
Web Workers

Deployment:
GitHub Actions
GitHub Pages

Optional specificity backend:
Small API service
Queued BLAST/Primer-BLAST jobs
```

Rust/WASM suits this project because the calculations are deterministic, testable and potentially CPU-intensive. `wasm-bindgen` provides JavaScript interoperability, while `wasm-pack` builds the browser-consumable package. GitHub Pages can publish the built static assets through a custom Actions workflow. ([GitHub Docs][10])

## Suggested repository structure

```text
fusion-pcr-studio/
├── Cargo.toml
├── LICENSE
├── README.md
├── CITATION.cff
├── CHANGELOG.md
├── METHODS.md
├── VALIDATION.md
├── crates/
│   ├── fusion-core/
│   │   ├── src/
│   │   │   ├── sequence.rs
│   │   │   ├── assembly.rs
│   │   │   ├── primer.rs
│   │   │   ├── thermodynamics.rs
│   │   │   ├── secondary_structure.rs
│   │   │   ├── specificity.rs
│   │   │   ├── translation.rs
│   │   │   ├── protocol.rs
│   │   │   ├── scoring.rs
│   │   │   └── optimizer.rs
│   │   └── tests/
│   └── fusion-wasm/
│       └── src/
├── web/
│   ├── src/
│   │   ├── components/
│   │   ├── canvas/
│   │   ├── workers/
│   │   ├── state/
│   │   ├── export/
│   │   └── profiles/
│   ├── public/
│   └── tests/
├── examples/
│   ├── exact-fusion/
│   ├── protein-fusion/
│   ├── insertion/
│   └── mutation/
├── test-data/
├── validation/
├── docs/
└── .github/
    └── workflows/
```

## Core Rust API

The computational core should expose functions similar to:

```rust
pub fn parse_sequence(input: &str) -> Result<Sequence, SequenceError>;

pub fn construct_target(project: &Project) -> Result<Sequence, DesignError>;

pub fn generate_primer_candidates(
    request: &PrimerRequest,
    conditions: &ReactionConditions,
) -> Vec<PrimerCandidate>;

pub fn calculate_tm(
    sequence: &str,
    conditions: &ThermodynamicConditions,
) -> Result<ThermodynamicResult, ThermodynamicError>;

pub fn analyze_hairpin(
    sequence: &str,
    conditions: &ThermodynamicConditions,
) -> StructureResult;

pub fn analyze_dimer(
    first: &str,
    second: &str,
    conditions: &ThermodynamicConditions,
) -> StructureResult;

pub fn optimize_design(
    project: &Project,
    settings: &OptimizationSettings,
) -> Result<Vec<CompleteDesign>, DesignError>;

pub fn simulate_products(
    design: &CompleteDesign,
) -> Result<SimulationResult, DesignError>;
```

Keep `fusion-core` free of browser dependencies so it can later support:

* Command-line use
* Python bindings
* Native desktop use
* Batch processing
* Reproducible pipelines

---

# 17. Data model

A project should be serializable to a documented JSON format.

```typescript
interface Project {
  schemaVersion: string;
  engineVersion: string;
  name: string;
  sources: SourceSequence[];
  target: TargetConstruct;
  junctions: Junction[];
  reactionConditions: ReactionConditions;
  selectedDesign?: CompleteDesign;
  createdAt: string;
  modifiedAt: string;
}
```

```typescript
interface PrimerCandidate {
  id: string;
  name: string;
  fullSequence: string;
  annealingSequence: string;
  fivePrimeTail: string;
  direction: "forward" | "reverse";
  templateId: string;
  templateStart: number;
  templateEnd: number;
  tmAnnealing: number;
  tmFullNominal: number;
  gcPercent: number;
  hairpin: StructureResult;
  selfDimer: StructureResult;
  specificity: SpecificityResult;
  warnings: DesignMessage[];
  scores: PrimerScores;
}
```

```typescript
interface Junction {
  id: string;
  upstreamFragmentId: string;
  downstreamFragmentId: string;
  insertedSequence: string;
  mode:
    | "exact"
    | "protein-fusion"
    | "insertion"
    | "deletion"
    | "substitution";
  preserveProtein: boolean;
  flexibleCodons: number;
  locked: boolean;
}
```

Every exported project must include the model version and all calculation parameters.

---

# 18. Primer3 integration and licensing

Primer3 is an important validation reference and already implements extensive primer selection and thermodynamic analyses. However, the official Primer3 repository is licensed under GPL-2.0. Directly incorporating or linking its code affects the licensing strategy for the distributed application. ([GitHub][11])

There are three reasonable approaches.

## Recommended approach

Implement an original Rust calculation engine from published models and use Primer3 as an external validation reference during development.

This allows the core architecture and OE-PCR-specific behavior to be designed cleanly.

## GPL application

Use Primer3 directly and release the complete application under a compatible GPL license.

## Separate optional service

Run Primer3 in an independently deployed service after obtaining appropriate licensing advice.

Do not copy Primer3 source into a permissively licensed repository without resolving this first.

---

# 19. Testing strategy

## Unit tests

Test:

* Reverse complements
* Circular coordinate extraction
* FASTA parsing
* GenBank parsing
* GC calculation
* Molecular-weight conversions
* Tm calculations
* Salt corrections
* Hairpin structures
* Dimer structures
* Codon translation
* Primer construction
* Amplicon simulation
* Fusion-product reconstruction

## Property-based tests

Useful invariants include:

```text
reverse_complement(reverse_complement(sequence)) == sequence
```

```text
simulated_final_product == requested_target_product
```

```text
inner_forward == reverse_complement(inner_reverse)
```

for the standard symmetric overlap design.

```text
mass_to_pmol(pmol_to_mass(x)) ≈ x
```

```text
Every primer 3′ body exactly matches its intended template.
```

## Reference tests

Compare Tm and structural outputs against:

* Primer3
* Published examples
* Carefully recorded IDT OligoAnalyzer outputs
* Hand-calculated small cases

Differences should be documented rather than silently adjusted until they appear similar.

## UI tests

Automate:

* Importing sequences
* Creating a two-fragment fusion
* Adding an insertion
* Fixing a frame warning
* Locking a primer
* Comparing candidates
* Exporting all formats
* Reloading a saved project

## Performance tests

Set targets such as:

```text
Two-fragment design:        <1 second
Four-fragment design:       <5 seconds
100 primer candidates:      <2 seconds
Cross-dimer matrix:         <3 seconds
Canvas interaction:         60-frame-per-second target
```

Calculations exceeding approximately 100 ms should run outside the main UI thread.

---

# 20. Scientific validation

Software agreement is not enough. The project should eventually include wet-lab validation.

Build a dataset containing:

* Exact two-fragment fusions
* Protein fusions
* Insertions
* Deletions
* Point mutations
* GC-rich junctions
* AT-rich junctions
* Long products
* Designs predicted to be weak
* Designs predicted to be strong

For each experiment, record:

```text
Engine version
Design parameters
Polymerase
Template type
Primer vendor and purification
Reaction conditions
Gel result
Observed product size
Yield, when measured
Sequencing result
Failure mode
Any manual optimization performed
```

Use the outcomes to calibrate ranking weights.

Do not train or tune only on successful experiments. Failed designs are particularly important for determining whether warnings are useful.

The application should initially say:

> Design quality scores summarize calculated primer and overlap properties. They are not experimentally measured probabilities of success.

Only after a substantial, independently evaluated dataset should the project consider reporting calibrated success likelihoods.

---

# 21. Documentation required in the repository

## `README.md`

Include:

* What the tool does
* Live application
* Screenshot or short demonstration
* Privacy statement
* Supported use cases
* Example workflow
* Installation for developers
* Scientific limitations
* Citation

## `METHODS.md`

Describe:

* Primer-generation algorithm
* Tm model
* Salt correction
* Secondary-structure model
* Specificity method
* Global optimization
* Scoring system
* Protocol profiles

## `VALIDATION.md`

Include:

* Reference tools
* Test tolerances
* Experimental validation
* Known discrepancies
* Unsupported cases

## `THERMODYNAMIC_MODELS.md`

Document:

* Constants
* Nearest-neighbour tables
* Initiation terms
* Symmetry terms
* Salt corrections
* Magnesium treatment
* DMSO correction
* Concentration assumptions

## `PROJECT_FORMAT.md`

Define the saved JSON schema and migration strategy.

## `POLYMERASE_PROFILES.md`

Explain how profiles are sourced, versioned and updated.

## `LIMITATIONS.md`

Explicitly state that the tool cannot fully predict:

* Template quality
* Contamination
* Actual polymerase activity
* Pipetting errors
* Complex template secondary structure
* Uncharacterized buffer effects
* Oligo synthesis failures
* Exact PCR yield
* Biological function of the assembled construct

---

# 22. Development roadmap

## Phase 1: Sequence and construct engine

Deliver:

* FASTA and plain-sequence import
* Linear fragment editing
* Exact two-fragment target assembly
* Reverse complement
* Base-level canvas
* Project save/load

Definition of done:

```text
A user can visually create an exact two-fragment target construct,
save it and reopen it without sequence changes.
```

## Phase 2: Basic primer generation

Deliver:

* Four-primer design for two fragments
* Separation of 5′ tails and 3′ bodies
* GC, length and simple Tm calculations
* Product simulation
* Primer CSV export

Definition of done:

```text
Every generated design reconstructs the requested final sequence.
```

## Phase 3: Full thermodynamics

Deliver:

* SantaLucia nearest-neighbour Tm
* Salt and magnesium corrections
* DMSO setting
* Hairpin analysis
* Self- and heterodimer analysis
* Structure diagrams

Definition of done:

```text
Reference calculations agree with established implementations
within documented numerical tolerances.
```

## Phase 4: Mutation and protein modes

Deliver:

* Insertions
* Deletions
* Substitutions
* Protein translation
* Frame checks
* Start/stop warnings
* Linker support

## Phase 5: Multi-fragment optimization

Deliver:

* Three- and four-fragment designs
* Global cross-dimer matrix
* Beam-search optimization
* Candidate comparison
* Hierarchical assembly recommendations

## Phase 6: Protocol engine

Deliver:

* Polymerase profiles
* Equimolar mixing
* Pipetting tables
* Extension-time calculation
* Annealing recommendations
* Expected gel bands
* Printable protocol

## Phase 7: Specificity

Deliver:

* Local template scanning
* Off-target product simulation
* Primer-BLAST handoff
* Optional online search service

## Phase 8: Validation and publication

Deliver:

* Experimental validation dataset
* Versioned release
* Methods document
* Citation file
* Reproducibility report
* Public GitHub Pages deployment

---

# 23. Minimum viable release

Version `0.1.0` should do only the following, but do it reliably:

* Import two DNA fragments
* Select the portions to fuse
* Insert an optional linker or mutation
* Display the final sequence
* Design four primers
* Separate each primer’s tail and annealing body
* Calculate body Tm, GC and basic structures
* Simulate both first-stage products
* Simulate the final fusion product
* Verify exact agreement with the target
* Generate a starting PCR plan
* Export primer CSV, FASTA, project JSON and protocol
* Run entirely locally in the browser

Do not delay the first release for:

* Whole-genome specificity
* Batch libraries
* Six-fragment assembly
* AI recommendations
* Vendor ordering
* Laboratory inventory integration

---

# 24. Features that would make it distinctive

The project becomes more than another primer calculator if it emphasizes these capabilities:

1. **Direct visual construction of the desired product**
2. **Clear separation of 5′ overlap tails from 3′ annealing bodies**
3. **Simulation of every intermediate DNA product**
4. **Exact final-sequence verification**
5. **Frame-aware protein fusion design**
6. **Intended-complementarity handling for inner primers**
7. **Global optimization across all primers**
8. **Hierarchical planning for multi-fragment assemblies**
9. **Transparent, explainable recommendations**
10. **Local processing with no sequence upload**
11. **Versioned calculations and reproducible project files**
12. **Wet-lab validation rather than unsupported success claims**

The strongest first implementation is therefore:

```text
fusion-pcr-studio
├── React/Vite visual application
├── Rust calculation core
├── WebAssembly browser package
├── two-stage OE-PCR workflow
├── exact sequence simulation
├── thermodynamic primer analysis
└── GitHub Pages deployment
```

This would be a credible flagship repository: scientifically relevant, visually demonstrable, computationally substantial, useful to bench researchers, and directly aligned with Mr Broketa’s existing browser-tool and Rust portfolio.

[1]: https://pubmed.ncbi.nlm.nih.gov/2744487/?utm_source=chatgpt.com "Site-directed mutagenesis by overlap extension using the ..."
[2]: https://www.neb.com/en/protocols/pcr-using-q5-high-fidelity-dna-polymerase-m0491?srsltid=AfmBOopJ778JRtYY5EevD_BQ8cGcDcZnzax9UvvfC2vno4jU2cEAiU7H&utm_source=chatgpt.com "PCR Using Q5® High-Fidelity DNA Polymerase ..."
[3]: https://primer3.org/manual.html?utm_source=chatgpt.com "Primer3 - Manual"
[4]: https://pubmed.ncbi.nlm.nih.gov/9465037/?utm_source=chatgpt.com "A unified view of polymer, dumbbell, and oligonucleotide ..."
[5]: https://pubmed.ncbi.nlm.nih.gov/18422348/?utm_source=chatgpt.com "Predicting stability of DNA duplexes in solutions containing ..."
[6]: https://primer3.org/manual.html "Primer3 - Manual"
[7]: https://www.idtdna.com/page/support-and-education/decoded-plus/using-the-oligoanalyzer-program?utm_source=chatgpt.com "How to use the OligoAnalyzer Tool | IDT"
[8]: https://www.ncbi.nlm.nih.gov/tools/primer-blast/?utm_source=chatgpt.com "Primer designing tool - NCBI - NIH"
[9]: https://www.neb.com/en/protocols/pcr-using-q5-hot-start-high-fidelity-dna-polymerase-m0493?srsltid=AfmBOooyh8IUQeAy22_dqraJnr7GWWkSY1Vt9mdAlH3RFPGNZWkcROYl&utm_source=chatgpt.com "PCR Using Q5® Hot Start High-Fidelity DNA Polymerase ..."
[10]: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages?utm_source=chatgpt.com "Using custom workflows with GitHub Pages"
[11]: https://github.com/primer3-org/primer3 "GitHub - primer3-org/primer3: Primer3 is a command line tool to select primers for polymerase chain reaction (PCR). · GitHub"
