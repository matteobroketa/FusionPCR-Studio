#[derive(Debug, Clone, PartialEq)]
pub struct SpecificitySummary {
    pub local_sites: usize,
    pub external_handoff_ready: bool,
}

impl Default for SpecificitySummary {
    fn default() -> Self {
        Self {
            local_sites: 0,
            external_handoff_ready: true,
        }
    }
}
