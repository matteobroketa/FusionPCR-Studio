#[derive(Debug, Clone, PartialEq, Default)]
pub struct OptimizationSettings {
    pub beam_width: usize,
    pub candidate_limit: usize,
}
