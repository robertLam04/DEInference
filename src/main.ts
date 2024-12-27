import { PublicKey } from "@solana/web3.js";
import { program, provider} from "./setup";
import { createTree } from "./createTree";
import { Wallet } from "@coral-xyz/anchor";
import { ValidDepthSizePair } from "@solana/spl-account-compression";

const main = async () => {
    const args = process.argv.slice(2);
    
    const connection = provider.connection;
    const wallet = provider.wallet as Wallet;

    // Derive the program state PDA
    let [programStatePda, _bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("knowledge")], // Same seed as in the Rust program
        program.programId
    );

    // Close the PDA and open a new one
    /* const closeTx = await program.methods.closeStateAccount()
    .accounts({
      programState: programStatePda,
      receiver: wallet.payer.publicKey
    }).signers([wallet.payer]).rpc({ commitment: 'confirmed'});
    */
    
    // Initialize program if not already initialized
    const programStateAccountInfo = await provider.connection.getAccountInfo(programStatePda);
    if (!programStateAccountInfo) {
        console.log("Program state not yet initialized, intializing...");
        const tx = await program.methods.initialize()
        .accounts({
        payer: wallet.publicKey,
        })
        .signers([wallet.payer])
        .rpc({commitment: 'confirmed'});
    }
    let programStateData = await program.account.programState.fetch(programStatePda);
    console.log("Program state initialized:", programStateData)

    // Create a merkle tree
    const maxDepthSizePair: ValidDepthSizePair = {
        maxDepth: 14,
        maxBufferSize: 64,
    }
    await createTree(maxDepthSizePair);

    //Re-Fetch program state again
    programStateData = await program.account.programState.fetch(programStatePda);
    console.log("Tree count:", programStateData.treeCount);

};

main();