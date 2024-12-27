// Create a merkle tree
import { program, provider } from "./setup";
import { Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { ConcurrentMerkleTreeAccount, createAllocTreeIx, ValidDepthSizePair } from "@solana/spl-account-compression";
import { Wallet } from "@coral-xyz/anchor";
import { findTreeConfigPda, MPL_BUBBLEGUM_PROGRAM_ID } from "@metaplex-foundation/mpl-bubblegum";

export const createTree = async (maxDepthSizePair : ValidDepthSizePair) => {

  const wallet = provider.wallet as Wallet;

  // Create tree account and allocate necessary space
  const tree = Keypair.generate();
  const allocTreeIx = await createAllocTreeIx(
    provider.connection,
    tree.publicKey,
    wallet.publicKey,
    maxDepthSizePair,
    maxDepthSizePair.maxDepth - 5
  );

  const allocTx = new Transaction().add(allocTreeIx);
  const allocTxSignature = await sendAndConfirmTransaction(
    provider.connection,
    allocTx,
    [wallet.payer, tree],
    {
      commitment: 'confirmed',
    }
  );

  // Derive tree_config pda
  let [treeConfig, _bump] = PublicKey.findProgramAddressSync(
    [tree.publicKey.toBuffer()], // Same seed as in the Rust program
    new PublicKey(MPL_BUBBLEGUM_PROGRAM_ID)
  );

  const tx = await program.methods
    .createTree(maxDepthSizePair.maxDepth, maxDepthSizePair.maxBufferSize)
    // Do not pass accounts that are automatically resolved
    .accounts({
      tree: tree.publicKey,
      treeConfig: treeConfig,
      payer: wallet.publicKey,
    }).signers([wallet.payer])
  .rpc({ commitment: 'confirmed'});

  const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
    provider.connection,
    tree.publicKey
  );
  
  console.log('MaxBufferSize', treeAccount.getMaxBufferSize());
  console.log('MaxDepth', treeAccount.getMaxDepth());
  console.log('Tree Authority', treeAccount.getAuthority().toString());
  console.log('Initial Root:', treeAccount.getCurrentRoot().toString('hex'));

}