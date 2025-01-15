use anchor_lang::prelude::*;
use std::str::FromStr;
use crate::state::ProgramState;

#[derive(Accounts)]
pub struct Initialize<'info> {
    // space = account disc (8) + pubkey (32) + vec size (4) + tree_count (2) + max_trees (1) * tree info (64)
    #[account(
        init, payer = payer, space = 46 + 1 * 66, seeds = [b"knowledge"], bump
    )]
    pub program_state: Account<'info, ProgramState>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    // Initialize program state account
    let program_state = &mut ctx.accounts.program_state;
    let creator_pbk_str = "2gUrmvYsLTpXB5VwjP2ZpXD4kY4HWRP89aDzQQ7TKbwh";
    let creator_pbk = Pubkey::from_str(creator_pbk_str)
        .map_err(|_| ProgramError::InvalidArgument)?;
    program_state.creator = creator_pbk;
    program_state.tree_count = 0;

    Ok(())
}