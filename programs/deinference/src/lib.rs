use anchor_lang::prelude::*;
use mpl_bubblegum::programs::{MPL_BUBBLEGUM_ID, SPL_ACCOUNT_COMPRESSION_ID, SPL_NOOP_ID};
use mpl_token_metadata::programs::MPL_TOKEN_METADATA_ID;
use crate::instructions::*;
use crate::instructions::setup::*;
mod instructions;
mod state;

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

#[derive(Clone)]
pub struct Metadata;

impl anchor_lang::Id for Metadata {
    fn id() -> Pubkey {
        MPL_TOKEN_METADATA_ID
    }
}

#[program]
pub mod knowledge_manager {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::setup::initialize(ctx)?;
        Ok(())
    }

    pub fn create_tree(ctx: Context<CreateTree>, max_depth: u32, max_buffer_size: u32) -> Result<()> {
        instructions::setup::create_tree(ctx, max_depth, max_buffer_size)?;
        Ok(())
    }

    pub fn mint(
        ctx: Context<Mint>,
        name: String,
        symbol: String,
        uri: String,
        seller_fee_basis_points: u16,
    ) -> Result<()> {
        instructions::mint(ctx, name, symbol, uri, seller_fee_basis_points)?;
        Ok(())
    }

    pub fn mint_to_collection(
        ctx: Context<MintToCollection>,
        name: String,
        symbol: String,
        uri: String,
        seller_fee_basis_points: u16
    ) -> Result<()> {
        instructions::mint_to_collection(ctx, name, symbol, uri, seller_fee_basis_points)?;
        Ok(())
    }

    pub fn close_state_account(ctx: Context<CloseStateAccount>) -> Result<()> {
        instructions::close_state_account(ctx)?;
        Ok(())
    }
}

