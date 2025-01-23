use anchor_lang::prelude::*;
use crate::state::TaskData;
use crate::Metadata;

#[derive(Accounts)]
pub struct CreateTask<'info> {
    // space = account disc (8) + mint (32) + model_count (2) + vec_size (4)
    // + max_models (4 for now) * model_data(length_prefix (4) + string_length (32) + pubkey (32) + leaf_index (2) + reputation (1))
    #[account(
        init, payer = payer, space = 330, seeds = [b"collection123", collection_mint.key().as_ref()], bump
    )]
    pub task_data: Account<'info, TaskData>,

    /// CHECK: unsafe
    pub collection_mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub mpl_token_metadata: Program<'info, Metadata>, 
    pub system_program: Program<'info, System>,
}

pub fn create_task(ctx: Context<CreateTask>) -> Result<()> {
    let collection_mint_pk = ctx.accounts.collection_mint.key;
    
    let task_data = &mut ctx.accounts.task_data;
    task_data.collection_mint = *collection_mint_pk;
    task_data.model_count = 0;

    msg!("DONE CREATING TASK");

    Ok(())
}





