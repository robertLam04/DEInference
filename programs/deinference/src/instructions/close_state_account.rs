use anchor_lang::prelude::*;
use crate::state::ProgramState;

#[derive(Accounts)]
pub struct CloseStateAccount<'info> {
    #[account(mut, close = receiver)]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub receiver: Signer<'info>,
}

pub fn close_state_account(ctx: Context<CloseStateAccount>) -> Result<()> {
    let program_state = &mut ctx.accounts.program_state;
    let lamports = **program_state.to_account_info().lamports.borrow();
    **ctx.accounts.receiver.to_account_info().lamports.borrow_mut() += lamports;
    **program_state.to_account_info().lamports.borrow_mut() = 0;
    Ok(())
}