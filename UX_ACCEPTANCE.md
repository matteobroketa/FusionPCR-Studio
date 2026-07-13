# UX Acceptance

Manual five-task usability script for the `0.1.0-alpha.3` two-fragment MVP.

## Task 1: Load The Exact Fusion Example

1. Open the application in a desktop browser.
2. Activate `Load exact fusion example` from the empty state using only the keyboard.
3. Wait for calculation to complete.

Expected result:

- The workbench opens without using Advanced settings.
- Focus moves to the `Stage-aware assembly map` heading.
- The project name is `Exact fusion example`.
- `Sequence reconstruction verified.` is visible.

## Task 2: Review The Junction

1. Open the `Junction` step.
2. Select Fragment A, the junction block, and Fragment B in turn.
3. On tablet width, confirm each selection opens the inspector slide-over.

Expected result:

- The construct remains the dominant workspace element.
- The contextual inspector changes with the selected object.
- Global design warnings do not appear inside the contextual inspector.

## Task 3: Review And Copy Primers

1. Open the `Primers` step.
2. Select each primer row from the compact primer table.
3. Use `Copy primer` for the selected primer and `Copy all primers` for the full set.
4. Repeat on a phone-sized viewport.

Expected result:

- Desktop shows a compact four-row table and one detail panel.
- Phone shows one primer detail panel at a time.
- Clipboard actions complete without exposing all four expanded reports on phone.

## Task 4: Review Protocol And Export

1. Open `Protocol & Export`.
2. Review the default protocol overview without opening Advanced settings.
3. Download `oligo CSV`, `primer FASTA`, `final construct FASTA`, `printable protocol`, and `project JSON`.

Expected result:

- The main export action is `Download oligo CSV`.
- All five public exports are enabled only for a current, valid design.
- Downloaded files contain finite values and the expected artifact type.

## Task 5: Confirm Destructive Actions

1. Activate `Clear project`.
2. Confirm focus lands on the dialog `Cancel` button.
3. Cancel the action.
4. Re-open the dialog and confirm the destructive action only if a recoverable snapshot is acceptable.

Expected result:

- Destructive actions always require confirmation.
- Focus returns to the triggering control after cancellation.
- The previous project remains recoverable after replacement or clearing.
