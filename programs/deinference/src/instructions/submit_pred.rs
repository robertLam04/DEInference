use anchor_lang::prelude::*;
use crate::state::{InferenceRequest, RequestStatus, ResultEntry, TaskData};
use crate::error::Errors;

#[derive(Accounts)]
#[instruction(request_id: u16)]
pub struct SubmitPred<'info> {
    #[account(mut)]
    pub model_owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"request", request_id.to_le_bytes().as_ref()],
        bump
    )]
    pub request_state: Account<'info, InferenceRequest>,

    /// CHECK: unsafe
    pub collection_mint: UncheckedAccount<'info>,

    #[account(
        seeds = [b"collection123", collection_mint.key().as_ref()],
        bump
    )]
    pub task_data: Account<'info, TaskData>,

}

pub fn submit_pred(ctx: Context<SubmitPred>, request_id: u16, weights_hash: [u8; 32], prediction: Vec<u8>) -> Result<()> {
    let task_data = &ctx.accounts.task_data;
    let request_state = &mut ctx.accounts.request_state;
    
    require_keys_eq!(task_data.collection_mint, *ctx.accounts.collection_mint.key);
    require!(task_data.has_model(&weights_hash), Errors::ModelNotFound);
    require_eq!(request_state.request_id, request_id);
    require_eq!(request_state.status.clone(), RequestStatus::Pending, Errors::InvalidStatus);

    let result = ResultEntry {
        weights_hash: weights_hash,
        prediction: prediction
    };

    request_state.results.push(result);

    Ok(())
}