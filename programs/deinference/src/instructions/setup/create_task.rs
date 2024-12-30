use anchor_lang::prelude::*;
use crate::state::TaskData;

#[derive(Accounts)]
pub struct CreateTask<'info> {
    // space = account disc (4) + mint (32) + name size (4) + max name (32) + uri size (4) + max uri (200) + model_count (2) + models (36 * 2)
    #[account(
        init, payer = payer, space = 350, seeds = [b"collection"], bump
    )]
    pub task_data: Account<'info, TaskData>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}





