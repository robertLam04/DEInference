use anchor_lang::prelude::*;
use std::str::FromStr;

#[account]
pub struct ProgramState {
    pub creator: Pubkey, // Program's authority
    pub tree_count: u16,
    pub trees: Vec<TreeInfo>
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TreeInfo {
    pub tree_address: Pubkey, // Address of the Merkle tree account
    pub tree_config: Pubkey,  // Associated tree configuration pda
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    // space = account disc (8) + pubkey (32) + vec size (4) + tree count (2) + max_trees * tree info (64)
    #[account(
        init, payer = payer, space = 46 + 2 * 64, seeds = [b"knowledge"], bump
    )]
    pub program_state: Account<'info, ProgramState>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let program_state = &mut ctx.accounts.program_state;

    let creator_pbk_str = "2gUrmvYsLTpXB5VwjP2ZpXD4kY4HWRP89aDzQQ7TKbwh";
    let creator_pbk = Pubkey::from_str(creator_pbk_str)
        .map_err(|_| ProgramError::InvalidArgument)?;
    program_state.creator = creator_pbk;

    program_state.tree_count = 0;

    Ok(())
}