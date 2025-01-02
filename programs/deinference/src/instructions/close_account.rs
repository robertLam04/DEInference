use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseAccount<'info> {
    #[account(mut)]
    ///CHECK: unsafe
    pub pda_account: UncheckedAccount<'info>,
    #[account(mut)]
    pub receiver: Signer<'info>,
}

pub fn close_account(ctx: Context<CloseAccount>) -> Result<()> {
    // Transfer lamports from the PDA account to the receiver
    let pda_account_info = &ctx.accounts.pda_account;
    let lamports = **pda_account_info.lamports.borrow();
    **ctx.accounts.receiver.to_account_info().lamports.borrow_mut() += lamports;

    // Set PDA account's lamports to 0
    **pda_account_info.lamports.borrow_mut() = 0;

    Ok(())
}