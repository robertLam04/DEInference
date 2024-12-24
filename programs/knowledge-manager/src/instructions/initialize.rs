use anchor_lang::prelude::*;

#[account]
pub struct ProgramState {
    pub creator: Pubkey, //Authority of Merkle tree
    pub max_buffer: u8,
    pub max_depth: u8,
    pub tree_address: Pubkey //Address of Merkle tree acc
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, payer = payer, space = 74, seeds = [b"knowledge"], bump
    )]
    pub program_state: Account<'info, ProgramState>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {Ok(())}