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
    InvalidStatus,
    #[msg("Wrong publickey provided to verify instruction")]
    InvalidPublicKey,
    #[msg("Invalid message provided to verify instruction")]
    InvalidMessage,
    #[msg("Invalid signature provided to verify instruction")]
    InvalidSignature,
    #[msg("Invalid Ed25519 instruction provided to verify instruction")]
    InvalidEd25519Instruction,
    #[msg("Missing Ed25519 instruction provided to verify instruction")]
    MissingEd25519Instruction,
}
