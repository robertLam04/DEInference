import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KnowledgeManager } from "../target/types/knowledge_manager";
require('dotenv').config();

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const program = anchor.workspace.KnowledgeManager as Program<KnowledgeManager>;