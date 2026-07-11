#[derive(Debug, Clone, PartialEq)]
pub struct StructureSummary {
    pub risk_label: &'static str,
    pub note: &'static str,
}

impl Default for StructureSummary {
    fn default() -> Self {
        Self {
            risk_label: "Not implemented",
            note: "Rust-side secondary-structure analysis is scaffolded but not yet ported from the web implementation.",
        }
    }
}
