use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SequenceRecord {
    pub normalized: String,
    pub reverse_complement: String,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum SequenceError {
    #[error("sequence is empty")]
    Empty,
    #[error("unsupported bases: {0}")]
    UnsupportedBases(String),
}

pub fn normalize_dna(input: &str) -> String {
    input
        .chars()
        .filter(|character| !character.is_whitespace())
        .flat_map(|character| character.to_uppercase())
        .collect()
}

pub fn validate_dna(input: &str, allow_n: bool) -> Result<String, SequenceError> {
    let normalized = normalize_dna(input);
    if normalized.is_empty() {
        return Err(SequenceError::Empty);
    }

    let invalid: Vec<char> = normalized
        .chars()
        .filter(|base| !matches!(base, 'A' | 'C' | 'G' | 'T') && !(allow_n && *base == 'N'))
        .collect();
    if invalid.is_empty() {
        Ok(normalized)
    } else {
        let summary = invalid
            .into_iter()
            .map(|base| base.to_string())
            .collect::<Vec<_>>()
            .join(", ");
        Err(SequenceError::UnsupportedBases(summary))
    }
}

pub fn reverse_complement(input: &str) -> String {
    normalize_dna(input)
        .chars()
        .rev()
        .map(|base| match base {
            'A' => 'T',
            'T' => 'A',
            'C' => 'G',
            'G' => 'C',
            'N' => 'N',
            _ => 'N',
        })
        .collect()
}

pub fn gc_fraction(input: &str) -> f64 {
    let normalized = normalize_dna(input);
    if normalized.is_empty() {
        return 0.0;
    }
    let gc_count = normalized
        .chars()
        .filter(|base| matches!(base, 'G' | 'C'))
        .count();
    gc_count as f64 / normalized.len() as f64
}

pub fn parse_sequence(input: &str) -> Result<SequenceRecord, SequenceError> {
    let normalized = validate_dna(input, true)?;
    Ok(SequenceRecord {
        reverse_complement: reverse_complement(&normalized),
        normalized,
    })
}
