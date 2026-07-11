#[derive(Debug, Clone, PartialEq)]
pub struct PrimerCandidate {
    pub name: String,
    pub full_sequence: String,
    pub annealing_sequence: String,
    pub five_prime_tail: String,
}
