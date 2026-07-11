pub fn pmol_to_mass_ng(pmol: f64, length_bp: usize) -> f64 {
    (pmol * length_bp as f64 * 660.0) / 1000.0
}

pub fn mass_ng_to_pmol(mass_ng: f64, length_bp: usize) -> f64 {
    (mass_ng * 1000.0) / (length_bp as f64 * 660.0)
}

pub fn volume_for_mass(required_mass_ng: f64, concentration_ng_per_ul: f64) -> f64 {
    required_mass_ng / concentration_ng_per_ul
}
