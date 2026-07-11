#[derive(Debug, Clone, PartialEq)]
pub struct ThermodynamicConditions {
    pub monovalent_millimolar: f64,
    pub magnesium_millimolar: f64,
    pub dntp_millimolar: f64,
    pub oligo_nanomolar: f64,
    pub dmso_percent: f64,
    pub dmso_factor: f64,
}

impl Default for ThermodynamicConditions {
    fn default() -> Self {
        Self {
            monovalent_millimolar: 50.0,
            magnesium_millimolar: 1.5,
            dntp_millimolar: 0.2,
            oligo_nanomolar: 500.0,
            dmso_percent: 0.0,
            dmso_factor: 0.6,
        }
    }
}
