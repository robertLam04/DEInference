use anchor_lang::prelude::*;
use mpl_bubblegum::programs::{MPL_BUBBLEGUM_ID, SPL_ACCOUNT_COMPRESSION_ID, SPL_NOOP_ID};
use crate::instructions::*;
mod instructions;

declare_id!("3zp1SJ5F93JvofRoFWmHf7k8ih3zGMpDLf7ftZqKE742");

#[derive(Clone)]
pub struct Noop;

impl anchor_lang::Id for Noop {
    fn id() -> Pubkey {
        SPL_NOOP_ID
    }
}

#[derive(Clone)]
pub struct SplAccountCompression;

impl anchor_lang::Id for SplAccountCompression {
    fn id() -> Pubkey {
        SPL_ACCOUNT_COMPRESSION_ID
    }
}

#[derive(Clone)]
pub struct MplBubblegum;

impl anchor_lang::Id for MplBubblegum {
    fn id() -> Pubkey {
        MPL_BUBBLEGUM_ID
    }
}

#[program]
pub mod knowledge_manager {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize(ctx)?;
        Ok(())
    }

    pub fn create_tree(ctx: Context<CreateTree>, max_depth: u32, max_buffer_size: u32) -> Result<()> {
        instructions::create_tree(ctx, max_depth, max_buffer_size)?;
        Ok(())
    }

    pub fn mint(ctx: Context<Mint>,
        name: String,
        symbol: String,
        uri: String,
        seller_fee_basis_points: u16,
    ) -> Result<()> {
        instructions::mint(ctx, name, symbol, uri, seller_fee_basis_points)?;
        Ok(())
    }

    pub fn close_account(ctx: Context<CloseAccount>) -> Result<()> {
        let account_to_close = &mut ctx.accounts.program_state;
        let lamports = **account_to_close.to_account_info().lamports.borrow();
        **ctx.accounts.receiver.to_account_info().lamports.borrow_mut() += lamports;
        **account_to_close.to_account_info().lamports.borrow_mut() = 0;
        Ok(())
    }
}

#[derive(Accounts)]
    pub struct CloseAccount<'info> {
        #[account(mut, close = receiver)]
        pub program_state: Account<'info, ProgramState>,
        #[account(mut)]
        pub receiver: Signer<'info>,
    }

