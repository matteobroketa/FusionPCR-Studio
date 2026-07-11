use fusion_core::{
    ChangeApprovals, CodingIntent, DesignMode, FragmentInput, FusionProject, construct_target,
    gc_fraction, mass_ng_to_pmol, parse_sequence, pmol_to_mass_ng, reverse_complement,
    volume_for_mass,
};

fn fragment(label: &str, sequence: &str, start: usize, end: usize) -> FragmentInput {
    FragmentInput {
        label: label.to_string(),
        sequence: sequence.to_string(),
        start,
        end,
    }
}

#[test]
fn parses_and_normalizes_sequence_records() {
    let record = parse_sequence(" atg ccn ").expect("sequence should parse");
    assert_eq!(record.normalized, "ATGCCN");
    assert_eq!(record.reverse_complement, "NGGCAT");
    assert!((gc_fraction("ATGC") - 0.5).abs() < f64::EPSILON);
    assert_eq!(reverse_complement("ATGC"), "GCAT");
}

#[test]
fn constructs_exact_target_from_selected_ranges() {
    let project = FusionProject {
        mode: DesignMode::Exact,
        insert_sequence: "GGTT".to_string(),
        coding: CodingIntent {
            upstream_frame: 0,
            downstream_frame: 0,
            retain_upstream_stop: true,
            retain_downstream_start: true,
        },
        change_approvals: ChangeApprovals {
            remove_upstream_stop: false,
            remove_downstream_start: false,
        },
        fragment_a: fragment("A", "AACCGGTT", 1, 4),
        fragment_b: fragment("B", "TTGGCCAA", 3, 8),
    };

    let target = construct_target(&project).expect("target should build");
    assert_eq!(target.selected_a, "AACC");
    assert_eq!(target.selected_b, "GGCCAA");
    assert_eq!(target.target_sequence, "AACCGGTTGGCCAA");
}

#[test]
fn applies_approved_protein_fusion_codon_removals() {
    let project = FusionProject {
        mode: DesignMode::ProteinFusion,
        insert_sequence: "GGTGGT".to_string(),
        coding: CodingIntent {
            upstream_frame: 0,
            downstream_frame: 0,
            retain_upstream_stop: false,
            retain_downstream_start: false,
        },
        change_approvals: ChangeApprovals {
            remove_upstream_stop: true,
            remove_downstream_start: true,
        },
        fragment_a: fragment("A", "ATGGCCGAACTGTAA", 1, 15),
        fragment_b: fragment("B", "ATGGGCTCCGACTGA", 1, 15),
    };

    let target = construct_target(&project).expect("target should build");
    assert_eq!(target.effective_selected_a, "ATGGCCGAACTG");
    assert_eq!(target.effective_selected_b, "GGCTCCGACTGA");
}

#[test]
fn converts_protocol_units() {
    let mass = pmol_to_mass_ng(0.05, 500);
    assert!((mass - 16.5).abs() < 1e-6);
    assert!((mass_ng_to_pmol(mass, 500) - 0.05).abs() < 1e-6);
    assert!((volume_for_mass(33.0, 11.0) - 3.0).abs() < 1e-6);
}
