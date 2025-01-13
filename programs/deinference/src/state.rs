use anchor_lang::prelude::*;
use crate::error::Errors;

#[account]
pub struct ProgramState {
    pub creator: Pubkey, // Program's authority
    pub tree_count: u16,
    pub trees: Vec<TreeInfo>,
    pub inf_req_counter: u16
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TreeInfo {
    pub tree_address: Pubkey, // Address of the Merkle tree account
    pub tree_config: Pubkey,  // Associated tree configuration pda
    pub current_index: u16,
}

impl ProgramState {
    pub fn get_tree(&self, target_tree_address: Pubkey) -> Option<&TreeInfo> {
        self.trees.iter().find(|tree| tree.tree_address == target_tree_address)
    }

    pub fn increment_index(&mut self, target_tree_address: Pubkey) -> Result<()> {
        if let Some(tree) = self.trees.iter_mut().find(|tree| tree.tree_address == target_tree_address) {
            tree.current_index = tree.current_index.checked_add(1)
                .ok_or(Errors::IndexOverflow)?; // Handle overflow safely
            Ok(())
        } else {
            Err(error!(Errors::TreeNotFound)) // Tree not found
        }
    }
}

// Account storing data about an inference task collection NFT
#[account]
pub struct TaskData {
    pub collection_mint: Pubkey,
    pub model_count: u16, // num models associated with this task
    pub models: Vec<ModelData>
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ModelData {
    pub weights_hash: [u8; 32], // unique identifier (Need to store model owner too later)
    pub tree_address: Pubkey, // tree where this model is stored
    pub leaf_index: u16,
    pub reputation: u8
}

#[account]
pub struct InferenceRequest {               
    pub user: Pubkey,      
    pub task_collection: Pubkey,      // associated task
    pub input_data: Vec<u8>,         // input data
    pub posted_at: i64,             // Timestamp of submission
    pub status: RequestStatus,         // Status of the request
    pub results: Vec<ResultEntry>,     // Results submitted by nodes (may need to move this to off chain storage)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum RequestStatus {
    Pending,
    Validated,
    Aggregated,
    Completed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ResultEntry {
    pub weights_hash: [u8; 32],    // model identifier      
    pub prediction_hash: [u8; 32],    // Hash of the result
}

// Unit tests
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_tree() {
        let tree_1 = TreeInfo {
            tree_address: Pubkey::new_unique(),
            tree_config: Pubkey::new_unique(),
            current_index: 0,
        };

        let tree_2 = TreeInfo {
            tree_address: Pubkey::new_unique(),
            tree_config: Pubkey::new_unique(),
            current_index: 1,
        };

        let program_state = ProgramState {
            creator: Pubkey::new_unique(),
            tree_count: 2,
            trees: vec![tree_1.clone(), tree_2.clone()],
            inf_req_counter: 0
        };

        // Test finding an existing tree
        let found_tree = program_state.get_tree(tree_1.tree_address);
        assert!(found_tree.is_some());
        assert_eq!(found_tree.unwrap().tree_address, tree_1.tree_address);

        // Test finding a non-existent tree
        let non_existent_tree = Pubkey::new_unique();
        assert!(program_state.get_tree(non_existent_tree).is_none());
    }

    #[test]
    fn test_increment_index() {
        let tree_1 = TreeInfo {
            tree_address: Pubkey::new_unique(),
            tree_config: Pubkey::new_unique(),
            current_index: 0,
        };

        let tree_2 = TreeInfo {
            tree_address: Pubkey::new_unique(),
            tree_config: Pubkey::new_unique(),
            current_index: u16::MAX, // Test for overflow
        };

        let mut program_state = ProgramState {
            creator: Pubkey::new_unique(),
            tree_count: 2,
            trees: vec![tree_1.clone(), tree_2.clone()],
            inf_req_counter: 0
        };

        // Increment index for an existing tree
        let result = program_state.increment_index(tree_1.tree_address);
        assert!(result.is_ok());
        let updated_tree = program_state.get_tree(tree_1.tree_address).unwrap();
        assert_eq!(updated_tree.current_index, 1);

        // Test overflow case
        let result = program_state.increment_index(tree_2.tree_address);
        assert!(result.is_err());

        // Test for a non-existent tree
        let non_existent_tree = Pubkey::new_unique();
        let result = program_state.increment_index(non_existent_tree);
        assert!(result.is_err());
    }
}