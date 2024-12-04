use anchor_lang::prelude::*;

declare_id!("3zp1SJ5F93JvofRoFWmHf7k8ih3zGMpDLf7ftZqKE742");

#[program]
pub mod knowledge_manager {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
