# inference-dec

## Overview

inference-dec is a dapp built on Solana for performing decentralized inference of ML models. 

### Features
- Immutability and ownership by storing the hash of the models weights in a cNFT.
- Decentralized inference with zk-proof validation.
- Reputation-based rewards for model owners.
- Aggregated predictions for accurate and trustless results.

### Process Flow
1. **Model Registration**  
   - Developer trains a model off-chain.  
   - Uploads hash of weights and mints to immutable cNFT.  
   - Reputation is set to a base value (stored in program state).  

2. **Inference Request**  
   - User submits an inference request specifying the input and desired model collection.  
   - Smart contract broadcasts this request to model owners (or third-party computation nodes).  

3. **Model Execution**  
   - Model owners or third-party computation nodes run the models locally.  
   - Predictions and proofs are returned to the smart contract.  

4. **Validation**  
   - Smart contract verifies each zk-proof to ensure:  
     - Model weights used correspond to the hash stored on-chain.  
     - Computational steps are correct.  

5. **Aggregation**  
   - Contract aggregates valid predictions using a weighted formula based on past model reputation.  
   - Final prediction is returned to the user.  

6. **Reputation Management**  
   - Reputation scores are updated based on the prediction's accuracy relative to the aggregated result.  

7. **Incentivization**  
   - Fractions of the cost for the prediction are paid out to model owners based on their reputation scores.

## How to Clone and Run (TODO)

### Dependencies
- Node.js, npm
- Solana CLI
- Anchor

