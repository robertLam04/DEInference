use anchor_lang::prelude::*;
use mpl_bubblegum::{instructions::MintV1CpiBuilder, types::{MetadataArgs, TokenProgramVersion, TokenStandard}};
use crate::{MplBubblegum, Noop, SplAccountCompression};

#[derive(Accounts)]
pub struct Mint<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    // Mut so the # of NFTs minted for this tree can be incremented
    #[account(mut)]
    /// CHECK: This account is neither written to nor read from. 
    pub tree_auth: UncheckedAccount<'info>,

    /// CHECK: unsafe
    #[account(mut)]
    pub tree: UncheckedAccount<'info>,

    #[account(
        seeds = [b"tree_owner", tree.key().as_ref()],
        bump
    )]
    /// CHECK: This account used as a signing PDA only
    pub tree_owner: UncheckedAccount<'info>,

    /// CHECK: This account is neither written to nor read from.
    pub leaf_owner: UncheckedAccount<'info>,

    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub bubblegum_program: Program<'info, MplBubblegum>,
    pub system_program: Program<'info, System>,
}

pub fn mint(
    ctx: Context<Mint>,
    name: String,
    symbol: String,
    uri: String,
    seller_fee_basis_points: u16,
    ) -> Result<()> {
    MintV1CpiBuilder::new(
        &ctx.accounts.bubblegum_program.to_account_info()
    ).tree_config(&ctx.accounts.tree_auth.to_account_info())
    .leaf_owner(&ctx.accounts.leaf_owner.to_account_info())
    .leaf_delegate(&ctx.accounts.leaf_owner.to_account_info())
    .merkle_tree(&ctx.accounts.tree.to_account_info())
    .payer(&ctx.accounts.payer.to_account_info())
    .tree_creator_or_delegate(&ctx.accounts.tree_owner.to_account_info())
    .log_wrapper(&ctx.accounts.log_wrapper.to_account_info())
    .compression_program(&ctx.accounts.compression_program.to_account_info())
    .system_program(&ctx.accounts.system_program.to_account_info())
    .metadata(MetadataArgs {
        name,
        uri,
        symbol,
        creators: vec![], // empty for now
        seller_fee_basis_points,
        primary_sale_happened: false,
        is_mutable: false,
        edition_nonce: Some(0),
        collection: None,
        uses: None,
        token_program_version: TokenProgramVersion::Original,
        token_standard: Some(TokenStandard::NonFungible),
    }).invoke_signed(&[&[
        b"tree_owner",
        ctx.accounts.tree.key().as_ref(),
        &[ctx.bumps.tree_owner],
    ]])?;
    Ok(())
}