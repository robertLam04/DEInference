use anchor_lang::prelude::*;

#[error_code]
pub enum Errors {
    #[msg("Tree not found.")]
    TreeNotFound,
    #[msg("Overflow occurred when incrementing index.")]
    IndexOverflow,
}
