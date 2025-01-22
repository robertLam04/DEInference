# DEInference

## Overview

DEInference is a lightweight smart-contract built on Solana for performing decentralized inference of ML models without a dedicated L1 chain. 

### Features
- Privacy and ownership of your own models
- Decentralized inference with consensus based validation.
- Reputation-based rewards for model owners.
- Aggregated predictions for accurate and trustless results.

### Process Flow
1. **Model Registration**  
   - Developer trains a model off-chain.  
   - Uploads a signed hash of weights and mints to immutable cNFT.  
   - Reputation is set to a base value.

2. **Inference Request**  
   - User submits an inference request specifying the input and desired model collection.
   - Smart contract broadcasts this request to model owners (or third-party computation nodes).  

3. **Model Execution**  
   - Model owners or third-party computation nodes run the models locally.
   - Predictions are returned to the smart contract.  

4. **Aggregation**  
   - Contract aggregates predictions using a weighted formula based on past model reputation.  
   - Final prediction is returned to the user.  

5. **Reputation Management**  
   - Reputation scores are updated based on the prediction's accuracy relative to the aggregated result.  

6. **Incentivization**  
   - Fractions of the cost for the prediction are paid out to model owners based on their reputation scores.

## How to Clone and Run (TODO)


