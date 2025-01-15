import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL, TransactionConfirmationStrategy } from "@solana/web3.js";

// Parse arguments
const [publicKeyString, solAmountString] = process.argv.slice(2);

if (!publicKeyString || !solAmountString) {
  console.error("Usage: ts-node fund.ts <public-key> <amount-in-sol>");
  process.exit(1);
}

console.log(publicKeyString);
const publicKey = new PublicKey(publicKeyString);
const solAmount = parseFloat(solAmountString);

(async () => {
  try {
    // Connect to the Solana cluster (testnet here)
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");

    console.log(`Airdropping ${solAmount} SOL to ${publicKey.toBase58()}...`);

    // Convert SOL to lamports
    const lamports = solAmount * LAMPORTS_PER_SOL;

    // Request airdrop
    const signature = await connection.requestAirdrop(publicKey, lamports);

    // Confirm transaction
    const latestBlockHash = await connection.getLatestBlockhash();
    const lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;

    const confirmationStrategy: TransactionConfirmationStrategy = {
      signature: signature,
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: lastValidBlockHeight
    }

    await connection.confirmTransaction(confirmationStrategy, 'finalized');

    console.log(`Successfully airdropped ${solAmount} SOL to ${publicKey.toBase58()}`);
  } catch (error) {
    console.error("Error during airdrop:", error);
  }
})();