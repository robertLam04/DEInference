use anchor_lang::prelude::*;
use crate::{error::Errors, state::TaskData};

#[event]
pub struct ModelRetrieved {
    pub weights_hash: [u8; 32],
    pub tree_address: Pubkey,
    pub leaf_index: u16,
    pub reputation: u8,
}

#[derive(Accounts)]
pub struct GetModel<'info>{
    #[account(
        mut,
        seeds = [b"collection123"],
        bump
    )]
    task_data: Account<'info, TaskData>,

    #[account(mut)]
    pub payer: Signer<'info>
}

pub fn get_model(ctx: Context<GetModel>, weights_hash: [u8; 32]) -> Result<()> {
    let task_data = &ctx.accounts.task_data;

    let model = task_data.
        models.
        iter().
        find(|model| model.weights_hash == weights_hash).
        ok_or(error!(Errors::ModelNotFound))?;
        
    emit!(ModelRetrieved {
        weights_hash: model.weights_hash,
        tree_address: model.tree_address,
        leaf_index: model.leaf_index,
        reputation: model.reputation,
    });

    Ok(())
}

