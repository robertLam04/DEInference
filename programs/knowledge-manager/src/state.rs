use anchor_lang::prelude::*;

#[account]
pub struct ProgramState {
    pub creator: Pubkey, // Program's authority
    pub tree_count: u16,
    pub trees: Vec<TreeInfo>
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TreeInfo {
    pub tree_address: Pubkey, // Address of the Merkle tree account
    pub tree_config: Pubkey,  // Associated tree configuration pda
}

// Account storing data about an inference task collection NFT
#[account]
pub struct TaskData {
    pub mint: Pubkey,
    pub name: String,
    pub uri: String,
    pub model_count: u16, // num models associated with this task
    pub models: ModelData
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ModelData {
    pub tree_address: Pubkey, // Tree where this model is stored
    pub leaf_index: u16,
    pub reputation: u8
}