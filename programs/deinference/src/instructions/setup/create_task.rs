use anchor_lang::prelude::*;
use crate::state::TaskData;
use crate::Metadata;
use mpl_token_metadata::accounts::Metadata as MPLMetadata;

#[derive(Accounts)]
pub struct CreateTask<'info> {
    // space = account disc (8) + mint (32) + model_count (2) + vec_size (4)
    // + max_models (1 for now) * model_data(length_prefix (4) + string_length (32) + pubkey (32) + leaf_index (2) + reputation (1))
    #[account(
        init, payer = payer, space = 117, seeds = [b"collection123"], bump
    )]
    pub task_data: Account<'info, TaskData>,

    /// CHECK: unsafe
    pub collection_mint: UncheckedAccount<'info>,
    
    /// CHECK: checked in program logic
    pub metadata: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub mpl_token_metadata: Program<'info, Metadata>, 
    pub system_program: Program<'info, System>,
}

pub fn create_task(ctx: Context<CreateTask>) -> Result<()> {
    let collection_mint_pk = ctx.accounts.collection_mint.key;
    let (expected_metadata_pk, _) = MPLMetadata::find_pda(collection_mint_pk); // Switch to create_pda(pk, bump) (less expensive)
    require_keys_eq!(expected_metadata_pk, ctx.accounts.metadata.key());

    let metadata = ctx.accounts.metadata.data.try_borrow_mut().unwrap();
    let metadata_data = MPLMetadata::deserialize(&mut metadata.as_ref())?;
    
    let task_data = &mut ctx.accounts.task_data;
    task_data.collection_mint = metadata_data.mint;
    task_data.model_count = 0;

    Ok(())
}





