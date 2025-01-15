use anchor_lang::prelude::*;
use mpl_bubblegum::programs::{MPL_BUBBLEGUM_ID, SPL_ACCOUNT_COMPRESSION_ID, SPL_NOOP_ID};
use mpl_token_metadata::programs::MPL_TOKEN_METADATA_ID;
use crate::instructions::*;
use crate::instructions::setup::*;
mod verify;
mod instructions;
mod state;
mod error;

declare_id!("GJFXHDjc5uCcjQcX2aovmPvD73igW5gvYQSMSh2nbhGd");

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

    pub fn create_task(ctx: Context<CreateTask>) -> Result<()> {
        instructions::setup::create_task(ctx)?;
        Ok(())
    }

    pub fn mint_to_task(
        ctx: Context<MintToTask>,
        name: String,
        symbol: String,
        uri: String,
        weights_signature: [u8; 64],
        seller_fee_basis_points: u16
    ) -> Result<()> {
        instructions::mint_to_task(ctx, name, symbol, uri, weights_signature, seller_fee_basis_points)?;
        Ok(())
    }

    pub fn post_request(ctx:Context<PostRequest>, request_id: u16, data: Vec<u8>) -> Result<()> {
        instructions::post_request(ctx, request_id, data)?;
        Ok(())
    }

    pub fn submit_pred(ctx:Context<SubmitPred>, request_id: u16, weights_hash: [u8; 32], prediction: Vec<u8>) -> Result<()> {
        instructions::submit_pred(ctx, request_id, weights_hash, prediction)?;
        Ok(())
    }

    pub fn get_model(ctx: Context<GetModel>, weights_hash: [u8; 32]) -> Result<()> {
        instructions::get_model(ctx, weights_hash)?; 
        Ok(())
    }

    pub fn close_account(ctx: Context<CloseAccount>) -> Result<()> {
        instructions::close_account(ctx)?;
        Ok(())
    }
}

