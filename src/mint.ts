import { Keypair } from "@solana/web3.js";
import { program, provider } from "./setup";

type ModelMetadata = {
    name: string;
    symbol: string;
    hash: string;
}

export const mintCNFT = (leafOwner: Keypair, metadata: ModelMetadata) => {
    
}