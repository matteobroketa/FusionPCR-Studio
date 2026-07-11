#[derive(Debug, Clone, PartialEq, Default)]
pub struct PrimerScoreBreakdown {
    pub tm_penalty: f64,
    pub gc_penalty: f64,
    pub structure_penalty: f64,
}
