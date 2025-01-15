use anchor_lang::prelude::*;
use mpl_bubblegum::instructions::MintToCollectionV1CpiBuilder;
use mpl_bubblegum::types::{Collection, MetadataArgs, TokenProgramVersion, TokenStandard};
use crate::error::Errors;
use crate::state::{ModelData, ProgramState, TaskData};
use crate::{MplBubblegum, Noop, SplAccountCompression, Metadata};
use crate::verify::verify_ed25519_instruction;

#[derive(Accounts)]
pub struct MintToTask<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"knowledge"],
        bump
        
    )]
    pub program_state: Account<'info, ProgramState>,

    #[account(
        mut,
        seeds = [b"collection123", collection_mint.key().as_ref()],
        bump
    )]
    pub task_data: Account<'info, TaskData>,

    /// CHECK: This account is checked in the downstream instruction
    #[account(mut)]
    pub tree_auth: UncheckedAccount<'info>,

    /// CHECK: This account is neither written to nor read from.
    pub model_owner: AccountInfo<'info>,

    #[account(mut)]
    /// CHECK: unsafe
    pub tree: UncheckedAccount<'info>,

    #[account(
        seeds = [b"tree_owner", tree.key().as_ref()],
        bump
    )]
    /// CHECK: unsafe
    pub collection_authority: UncheckedAccount<'info>,

    /// CHECK: This account is checked in the instruction
    pub collection_mint: UncheckedAccount<'info>,

    /// CHECK: unsafe
    #[account(mut)]
    pub collection_metadata: UncheckedAccount<'info>,

    /// CHECK: This account is checked in the instruction
    pub edition_account: UncheckedAccount<'info>,

    /// CHECK: Sysvar account for instruction introspection
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: AccountInfo<'info>,

    /// CHECK: This is just used as a signing PDA.
    pub bubblegum_signer: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub bubblegum_program: Program<'info, MplBubblegum>,
    pub system_program: Program<'info, System>,
}

pub fn mint_to_task(ctx: Context<MintToTask>, name: String, symbol: String, weights: String, weights_signature: [u8; 64], seller_fee_basis_points: u16) -> Result<()> {
    let weights_clone = weights.clone();
    MintToCollectionV1CpiBuilder::new(
        &ctx.accounts.bubblegum_program.to_account_info(),
    )
        .tree_config(&ctx.accounts.tree_auth.to_account_info())
        .leaf_owner(&ctx.accounts.model_owner.to_account_info())
        .leaf_delegate(&ctx.accounts.model_owner.to_account_info())
        .merkle_tree(&ctx.accounts.tree.to_account_info())
        .payer(&ctx.accounts.payer.to_account_info())
        .tree_creator_or_delegate(&ctx.accounts.collection_authority.to_account_info())
        .collection_authority(&ctx.accounts.collection_authority.to_account_info())
        .collection_authority_record_pda(Some(&ctx.accounts.bubblegum_program.to_account_info()))
        .collection_mint(&ctx.accounts.collection_mint.to_account_info())
        .collection_metadata(&ctx.accounts.collection_metadata.to_account_info())
        .collection_edition(&ctx.accounts.edition_account.to_account_info())
        .bubblegum_signer(&ctx.accounts.bubblegum_signer.to_account_info())
        .log_wrapper(&ctx.accounts.log_wrapper.to_account_info())
        .compression_program(&ctx.accounts.compression_program.to_account_info())
        .system_program(&ctx.accounts.system_program.to_account_info())
        .token_metadata_program(&ctx.accounts.token_metadata_program.to_account_info())
        .metadata(
            MetadataArgs {
                name,
                symbol,
                uri: weights,
                creators: vec![],
                seller_fee_basis_points,
                primary_sale_happened: false,
                is_mutable: false,
                edition_nonce: Some(0),
                uses: None,
                collection: Some(Collection {
                    verified: true,
                    key: ctx.accounts.collection_mint.key(),
                }),
                token_program_version: TokenProgramVersion::Original,
                token_standard: Some(TokenStandard::NonFungible),
            }
        )
        .invoke_signed(&[&[
            b"tree_owner",
            ctx.accounts.tree.key().as_ref(),
            &[ctx.bumps.collection_authority]
    ]])?;

    // Ensure the weights_hash are signed by the model owner
    verify_ed25519_instruction(
        &ctx.accounts.instruction_sysvar,
        ctx.accounts.model_owner.key.as_ref(),
        weights_clone.as_bytes(),
        &weights_signature
    )?;

    // Increment model count for this task
    let task_data = &mut ctx.accounts.task_data;
    task_data.model_count += 1;

    // Append model to task data
    let program_state = &mut ctx.accounts.program_state;
    let tree = &ctx.accounts.tree;
    let leaf_index = program_state.
        get_tree(*tree.key).
        ok_or(error!(Errors::TreeNotFound))?.current_index;
    
    let model = ModelData {
        weights_hash: weights_clone.as_bytes().try_into().expect("URI must be 32 bytes"),
        tree_address: *ctx.accounts.tree.key,
        leaf_index: leaf_index,
        reputation: 0 // inital value
    };

    task_data.models.push(model);

    // Increment tree index
    program_state.increment_index(*tree.key)?;
    
    Ok(())
}