use anchor_lang::prelude::*;

#[error_code]
pub enum Errors {
    #[msg("Tree not found.")]
    TreeNotFound,
    #[msg("Overflow occurred when incrementing index.")]
    IndexOverflow,
    #[msg("Model not found.")]
    ModelNotFound,
    #[msg("Model count for this task must be greater than the minimum")]
    ModelCountTooLow,
    #[msg("Invalid status")]
    InvalidStatus
}
