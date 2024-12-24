import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KnowledgeManager } from "../target/types/knowledge_manager";
import {
  findTreeConfigPda,
  findLeafAssetIdPda
} from '@metaplex-foundation/mpl-bubblegum';
import { assertAccountExists, Umi, PublicKey as UmiPK } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { PublicKey, Keypair, TransactionConfirmationStrategy, Transaction, sendAndConfirmTransaction, TransactionSignature } from "@solana/web3.js";
import { assert } from "chai";
import { ChangeLogEventV1, ConcurrentMerkleTreeAccount, createAllocTreeIx, deserializeChangeLogEventV1, ValidDepthSizePair } from "@solana/spl-account-compression";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { rpc } from "@coral-xyz/anchor/dist/cjs/utils";

describe("knowledge-manager", () => {
  
  let programStateAccountInfo;
  let treeAccount: ConcurrentMerkleTreeAccount;

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.KnowledgeManager as Program<KnowledgeManager>;
  const connection = provider.connection;

  const umi = createUmi(connection.rpcEndpoint);
  umi.use(dasApi());

  // Derive the PDA (tree_state) with the same seeds as the program
  let [programStatePda, _bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("knowledge")], // Same seed as in the Rust program
    program.programId
  );

  // Create merkle tree account
  const tree = Keypair.generate();

  // Derive tree owner account pda
  const treeOwner = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode('tree_owner'),
      tree.publicKey.toBuffer(),
    ],
    program.programId
  );

  // Derive tree config account pda (owned by bubblegum program)
  const treeConfig = findTreeConfigPda(umi, {
    merkleTree: tree.publicKey.toBase58() as UmiPK,
  });

  // Define tree attributes
  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 14,
    maxBufferSize: 64,
  };
  const canopyDepth = maxDepthSizePair.maxDepth - 5;

  before(async () => {
    // Close pda state account
    const closeTx = await program.methods.closeAccount()
    .accounts({
      programState: programStatePda,
      receiver: wallet.payer.publicKey
    }).signers([wallet.payer]).rpc({ commitment: 'confirmed'});
    
    // Give tree account space
    const allocTreeIx = await createAllocTreeIx(
      connection,
      tree.publicKey,
      wallet.publicKey,
      maxDepthSizePair,
      canopyDepth
    );

    const tx = new Transaction().add(allocTreeIx);
    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [wallet.payer, tree],
      {
        commitment: 'confirmed',
      }
    );

    console.log('Tree Address:', tree.publicKey.toBase58());

  });

  it("Initializes the program state pda", async () => {
    
    // Call the initialize function
    const tx = await program.methods.initialize()
    .accounts({
      payer: wallet.publicKey,
    })
    .signers([wallet.payer])
    .rpc({commitment: 'confirmed'});

    // Fetch the tree_state account
    programStateAccountInfo = await provider.connection.getAccountInfo(programStatePda);

    assert.strictEqual(
      programStateAccountInfo.owner.toString(),
      program.programId.toString(),
      "tree_state account is not owned by the program"
    );

    assert.strictEqual(
      programStateAccountInfo.data.length,
      74, // Allocated size for TreeState
      "tree_state account data size is incorrect"
    );
  });

  it("Creates an empty merkle tree", async () => {

    const tx = await program.methods
    .createTree(maxDepthSizePair.maxDepth, maxDepthSizePair.maxBufferSize)
    // Do not pass accounts that are automatically resolved
    .accounts({
      tree: tree.publicKey,
      treeConfig: treeConfig[0],
      payer: wallet.publicKey,
    }).signers([wallet.payer])
    .rpc({ commitment: 'confirmed'});

    treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      tree.publicKey
    );

    console.log('MaxBufferSize', treeAccount.getMaxBufferSize());
    console.log('MaxDepth', treeAccount.getMaxDepth());
    console.log('Tree Authority', treeAccount.getAuthority().toString());
    console.log('Initial Root:', treeAccount.getCurrentRoot().toString('hex'));

    assert.ok(programStateAccountInfo, "Program state account should be initialized before creating tree"); 
    assert.strictEqual(treeAccount.getMaxDepth(), maxDepthSizePair.maxDepth, "Unexpected max depth");
    assert.strictEqual(treeAccount.getMaxBufferSize(), maxDepthSizePair.maxBufferSize, "Unexepected max buffer size");

  });

  it("Mints an NFT to an existing merkle tree", async () => {
    const leafOwner = Keypair.generate();

    const metadata = {
      uri: 'https://arweave.net/h19GMcMz7RLDY7kAHGWeWolHTmO83mLLMNPzEkF32BQ',
      name: 'TEST-NFT',
      symbol: 'TNFT'
    }

    assert.ok(treeAccount, "Tree account should exist before minting NFTs");
    
    const tx: TransactionSignature = await program.methods
    .mint(metadata.name, metadata.symbol, metadata.uri, 10)
    .accounts({
      payer: wallet.publicKey,
      tree: tree.publicKey,
      treeAuth: treeConfig[0],
      leafOwner: leafOwner.publicKey
    }).signers([wallet.payer]).rpc({ commitment: 'confirmed'});

    const transactionDetails = await connection.getTransaction(tx, {
      maxSupportedTransactionVersion: 1,
      commitment: 'confirmed'
    });

    //Extract leaf index from change logs
    let changeLogEvents: ChangeLogEventV1[] = [];
    transactionDetails.meta?.innerInstructions?.forEach((compiledIx) => {
      compiledIx.instructions.forEach((innerIx) => {
        try {
          // try to deserialize the cpi data as a changelog event
          changeLogEvents.push(
            deserializeChangeLogEventV1(Buffer.from(bs58.decode(innerIx.data)))
          );
        } catch (__) {
          // this noop cpi is not a changelog event. do nothing with it.
        }
      });
    });
    const leafIndex = changeLogEvents[0].index;

    const [assetId, bump] = await findLeafAssetIdPda(umi, {
      merkleTree: tree.publicKey.toBase58() as UmiPK,
      leafIndex,
    });

    console.log("Leaf Index:", leafIndex);
    console.log("Tree pk:", tree.publicKey.toBase58())

    const rpcAsset = await umi.rpc.getAsset(assetId);

    console.log("NFT Name:", rpcAsset.content.metadata.name);

  });
});
