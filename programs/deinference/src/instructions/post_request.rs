use anchor_lang::prelude::*;
use crate::{error::Errors, state::{InferenceRequest, ProgramState, RequestStatus, TaskData}};

#[event]
pub struct Request {
    request_id: u16,
    task_collection: Pubkey,
    request_data: Vec<u8>,
    posted_at: i64,
    status: RequestStatus
}

#[derive(Accounts)]
#[instruction(request_id: u16)]
pub struct PostRequest<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"collection123", collection_mint.key().as_ref()],
        bump
    )]
    pub task_data: Account<'info, TaskData>,

    #[account(
        mut,
        seeds = [b"knowledge"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,

    #[account(
        init,
        payer = user,
        // 8 (disc) + 32 (user) + 32 (task_collection) + 2 (request_id) + (4 (vec length prefix) + 32 (max length prefix) * 1 (u8)  (input_data)) + 8 (posted_at) + 1 (status) + 4 (Vec length prefix) + 10 (max_num_results) * (32 * 2) (results_entry)  = 763
        space = 763,
        seeds = [b"request", request_id.to_le_bytes().as_ref()],
        bump
    )]
    pub request_state: Account<'info, InferenceRequest>,

    /// CHECK: unsafe
    pub collection_mint: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn post_request(ctx: Context<PostRequest>, request_id: u16, request_data: Vec<u8>, required_predictions: u16) -> Result<()> {
    let task_data = &ctx.accounts.task_data;

    // Verify the collection mint matches the task data account
    require_keys_eq!(
        task_data.collection_mint,
        ctx.accounts.collection_mint.key()
    );

    let clock = Clock::get()?;
    let posted_at = clock.unix_timestamp;

    emit!(Request{
        request_id: request_id,
        task_collection: *ctx.accounts.collection_mint.key,
        request_data: request_data.clone(),
        posted_at: posted_at,
        status: RequestStatus::Pending
    });

    // Store state info
    let request_state = &mut ctx.accounts.request_state;
    request_state.input_data = request_data.try_into().expect("Vec length matched array length"); 
    request_state.posted_at = posted_at;
    request_state.status = RequestStatus::Pending;
    request_state.task_collection = *ctx.accounts.collection_mint.key;
    request_state.request_id = request_id;
    request_state.user = *ctx.accounts.user.key;
    request_state.required_predictions = required_predictions;

    Ok(())
}