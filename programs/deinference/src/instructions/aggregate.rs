use anchor_lang::prelude::*;
use crate::{error::Errors, state::{InferenceRequest, ModelData, ResultEntry, TaskData}};

#[derive(Accounts)]
#[instruction(request_id: u16)]
pub struct Aggregate<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"request", request_id.to_le_bytes().as_ref()],
        bump
    )]
    pub request_state: Account<'info, InferenceRequest>,

    #[account(
        seeds = [b"collection123", request_state.task_collection.key().as_ref()], bump
    )]
    pub task_data: Account<'info, TaskData>,

}

pub fn aggregate(ctx: Context<Aggregate>, _request_id: u16, algorithm: AggregationAlgorithm) -> Result<()> {
    let predictions = &ctx.accounts.request_state.results;
    let models = &ctx.accounts.task_data.models;
    require!(predictions.len() >= ctx.accounts.request_state.required_predictions.into(), Errors::NotEnoughPredictions);
    match algorithm {
        AggregationAlgorithm::WeightedMedian => {
            let aggregate_pred = weighted_median(predictions, models);
        },
    }
    Ok(())
}

// Prediction must be exactly 4 bytes
fn weighted_median(predictions: &Vec<ResultEntry>, models: &Vec<ModelData>) -> Option<f32> {
    let mut total_reputation: u32 = 0;

    let mut prediction_reputation_map: Vec<(f32, u32)> = predictions
        .iter()
        .filter_map(|result| {
            models
                .iter()
                .find(|model| model.weights_hash == result.weights_hash)
                .and_then(|model| {
                    let prediction_bytes: [u8; 4] = result.prediction
                        .get(0..4) // Take the first 4 bytes
                        .and_then(|slice| slice.try_into().ok()) // Convert to [u8; 4]
                        ?;

                    // Convert bytes to f32
                    let prediction_value = f32::from_be_bytes(prediction_bytes);

                    // Update the total reputation dynamically
                    total_reputation += model.reputation as u32;

                    Some((prediction_value, model.reputation as u32)) // Store raw reputation temporarily
                })
        })
        .collect();

    msg!("Total reputation: {}", total_reputation);
    for (prediction, reputation) in &prediction_reputation_map {
        msg!("Prediction: {}, Reputation: {}", prediction, reputation);
    }

    // Normalize reputations such that the sum of normalized predictions is 1
    if total_reputation == 0 {
        return None
    }

    let normalized_prediction_reputation_map: Vec<(f32, f32)> = prediction_reputation_map
        .iter()
        .map(|(prediction, reputation)| (*prediction, *reputation as f32 / total_reputation as f32))
        .collect();

    for (prediction, reputation) in &normalized_prediction_reputation_map {
        msg!("Prediction: {}, Reputation: {}", prediction, reputation);
    }

    let mut weighted_predictions: Vec<f32> = normalized_prediction_reputation_map
    .iter()
    .map(|(prediction, normalized_reputation)| prediction * *normalized_reputation as f32)
    .collect();

    weighted_predictions.sort_by(|a, b| {
        a.partial_cmp(b).unwrap()
    });

    let preds_sum: f32 = weighted_predictions.iter().sum();
    let mut cumulative_pred: f32 = 0.0;
    for prediction in weighted_predictions {
        cumulative_pred += prediction;
        if cumulative_pred >= preds_sum / 2.0 {
            msg!("Returning aggregated prediction: {}", prediction * total_reputation as f32);
            return Some(prediction * total_reputation as f32 );
        }
    }

    None
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum AggregationAlgorithm {
    WeightedMedian,
}