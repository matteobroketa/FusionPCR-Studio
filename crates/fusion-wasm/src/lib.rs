use fusion_core::{FusionProject, construct_target, parse_sequence};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn normalize_sequence_record(input: &str) -> Result<JsValue, JsValue> {
    let record = parse_sequence(input).map_err(|error| JsValue::from_str(&error.to_string()))?;
    serde_wasm_bindgen::to_value(&record).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn construct_target_from_project(project: JsValue) -> Result<JsValue, JsValue> {
    let project: FusionProject =
        serde_wasm_bindgen::from_value(project).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let target = construct_target(&project).map_err(|error| JsValue::from_str(&error.to_string()))?;
    serde_wasm_bindgen::to_value(&target).map_err(|error| JsValue::from_str(&error.to_string()))
}
