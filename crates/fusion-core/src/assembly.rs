use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::sequence::{SequenceError, normalize_dna, validate_dna};

const STOP_CODONS: [&str; 3] = ["TAA", "TAG", "TGA"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesignMode {
    Exact,
    ProteinFusion,
    Insertion,
    Deletion,
    Substitution,
    DomainSwap,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FragmentInput {
    pub label: String,
    pub sequence: String,
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CodingIntent {
    pub upstream_frame: u8,
    pub downstream_frame: u8,
    pub retain_upstream_stop: bool,
    pub retain_downstream_start: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChangeApprovals {
    pub remove_upstream_stop: bool,
    pub remove_downstream_start: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FusionProject {
    pub mode: DesignMode,
    pub insert_sequence: String,
    pub coding: CodingIntent,
    pub change_approvals: ChangeApprovals,
    pub fragment_a: FragmentInput,
    pub fragment_b: FragmentInput,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConstructTarget {
    pub selected_a: String,
    pub selected_b: String,
    pub effective_selected_a: String,
    pub effective_selected_b: String,
    pub insert_sequence: String,
    pub target_sequence: String,
}

#[derive(Debug, Error)]
pub enum DesignError {
    #[error(transparent)]
    Sequence(#[from] SequenceError),
}

fn clamp_range(length: usize, start: usize, end: usize) -> (usize, usize) {
    let lower = start.max(1).min(length.max(1));
    let upper = end.max(1).min(length.max(1));
    (lower.min(upper), lower.max(upper))
}

fn selected_fragment(fragment: &FragmentInput) -> Result<String, SequenceError> {
    let sequence = validate_dna(&fragment.sequence, false)?;
    let (start, end) = clamp_range(sequence.len(), fragment.start, fragment.end);
    Ok(sequence[start - 1..end].to_string())
}

fn remove_last_in_frame_stop(sequence: &str, frame: u8) -> String {
    let frame = usize::from(frame.min(2));
    if sequence.len() < frame + 3 {
        return sequence.to_string();
    }
    let coding_length = sequence.len().saturating_sub(frame);
    let remainder = coding_length % 3;
    let last_codon_start = sequence.len().saturating_sub(remainder + 3);
    let last_codon = &sequence[last_codon_start..last_codon_start + 3];
    if STOP_CODONS.contains(&last_codon) {
        format!("{}{}", &sequence[..last_codon_start], &sequence[last_codon_start + 3..])
    } else {
        sequence.to_string()
    }
}

fn remove_first_in_frame_start(sequence: &str, frame: u8) -> String {
    let frame = usize::from(frame.min(2));
    if sequence.len() < frame + 3 {
        return sequence.to_string();
    }
    let first_codon = &sequence[frame..frame + 3];
    if first_codon == "ATG" {
        format!("{}{}", &sequence[..frame], &sequence[frame + 3..])
    } else {
        sequence.to_string()
    }
}

pub fn construct_target(project: &FusionProject) -> Result<ConstructTarget, DesignError> {
    let insert_sequence = normalize_dna(&project.insert_sequence);
    let selected_a = selected_fragment(&project.fragment_a)?;
    let selected_b = selected_fragment(&project.fragment_b)?;
    let mut effective_selected_a = selected_a.clone();
    let mut effective_selected_b = selected_b.clone();

    if matches!(project.mode, DesignMode::ProteinFusion) {
        if !project.coding.retain_upstream_stop && project.change_approvals.remove_upstream_stop {
            effective_selected_a = remove_last_in_frame_stop(&effective_selected_a, project.coding.upstream_frame);
        }
        if !project.coding.retain_downstream_start && project.change_approvals.remove_downstream_start {
            effective_selected_b = remove_first_in_frame_start(&effective_selected_b, project.coding.downstream_frame);
        }
    }

    let target_sequence = format!("{effective_selected_a}{insert_sequence}{effective_selected_b}");
    Ok(ConstructTarget {
        selected_a,
        selected_b,
        effective_selected_a,
        effective_selected_b,
        insert_sequence,
        target_sequence,
    })
}
