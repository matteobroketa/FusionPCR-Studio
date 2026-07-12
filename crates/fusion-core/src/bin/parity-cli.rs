use std::io::{self, Read};

use fusion_core::{
    FusionProject, construct_target, gc_fraction, mass_ng_to_pmol, parse_sequence,
    pmol_to_mass_ng, reverse_complement, volume_for_mass,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct BatchRequest {
    requests: Vec<Request>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "operation", rename_all = "kebab-case")]
enum Request {
    ParseSequence { input: String },
    ReverseComplement { input: String },
    GcFraction { input: String },
    ConstructTarget { project: FusionProject },
    ProtocolConversions {
        pmol: f64,
        length_bp: usize,
        mass_ng: f64,
        concentration_ng_per_ul: f64,
    },
}

#[derive(Debug, Serialize)]
struct BatchResponse {
    responses: Vec<Response>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
enum Response {
    ParseSequence {
        ok: bool,
        normalized: Option<String>,
        reverse_complement: Option<String>,
        error: Option<String>,
    },
    ReverseComplement {
        sequence: String,
    },
    GcFraction {
        gc_fraction: f64,
    },
    ConstructTarget {
        ok: bool,
        selected_a: Option<String>,
        selected_b: Option<String>,
        effective_selected_a: Option<String>,
        effective_selected_b: Option<String>,
        insert_sequence: Option<String>,
        target_sequence: Option<String>,
        error: Option<String>,
    },
    ProtocolConversions {
        mass_ng: f64,
        pmol: f64,
        volume_ul: f64,
    },
}

fn main() {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read stdin");

    let request: BatchRequest =
        serde_json::from_str(&input).expect("failed to deserialize parity request");

    let responses = request
        .requests
        .into_iter()
        .map(|request| match request {
            Request::ParseSequence { input } => match parse_sequence(&input) {
                Ok(record) => Response::ParseSequence {
                    ok: true,
                    normalized: Some(record.normalized),
                    reverse_complement: Some(record.reverse_complement),
                    error: None,
                },
                Err(error) => Response::ParseSequence {
                    ok: false,
                    normalized: None,
                    reverse_complement: None,
                    error: Some(error.to_string()),
                },
            },
            Request::ReverseComplement { input } => Response::ReverseComplement {
                sequence: reverse_complement(&input),
            },
            Request::GcFraction { input } => Response::GcFraction {
                gc_fraction: gc_fraction(&input),
            },
            Request::ConstructTarget { project } => match construct_target(&project) {
                Ok(target) => Response::ConstructTarget {
                    ok: true,
                    selected_a: Some(target.selected_a),
                    selected_b: Some(target.selected_b),
                    effective_selected_a: Some(target.effective_selected_a),
                    effective_selected_b: Some(target.effective_selected_b),
                    insert_sequence: Some(target.insert_sequence),
                    target_sequence: Some(target.target_sequence),
                    error: None,
                },
                Err(error) => Response::ConstructTarget {
                    ok: false,
                    selected_a: None,
                    selected_b: None,
                    effective_selected_a: None,
                    effective_selected_b: None,
                    insert_sequence: None,
                    target_sequence: None,
                    error: Some(error.to_string()),
                },
            },
            Request::ProtocolConversions {
                pmol,
                length_bp,
                mass_ng,
                concentration_ng_per_ul,
            } => Response::ProtocolConversions {
                mass_ng: pmol_to_mass_ng(pmol, length_bp),
                pmol: mass_ng_to_pmol(mass_ng, length_bp),
                volume_ul: volume_for_mass(mass_ng, concentration_ng_per_ul),
            },
        })
        .collect();

    let response = BatchResponse { responses };
    println!(
        "{}",
        serde_json::to_string(&response).expect("failed to serialize parity response")
    );
}
