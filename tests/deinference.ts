import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KnowledgeManager } from "../target/types/knowledge_manager";
import {
  findTreeConfigPda,
  findLeafAssetIdPda,
  MPL_BUBBLEGUM_PROGRAM_ID,
} from '@metaplex-foundation/mpl-bubblegum';
import { updateMetadataAccountV2, fetchDigitalAsset, mplTokenMetadata, createAndMint, updateAsUpdateAuthorityV2, updateV1 } from "@metaplex-foundation/mpl-token-metadata";
import { MPL_TOKEN_METADATA_PROGRAM_ID, createNft } from '@metaplex-foundation/mpl-token-metadata';
import { percentAmount, PublicKey as UmiPK, generateSigner, OptionOrNullable, some, signerIdentity, createSignerFromKeypair, KeypairSigner, transactionBuilder, Umi } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { PublicKey, Keypair, TransactionConfirmationStrategy, Transaction, sendAndConfirmTransaction, TransactionSignature, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { ChangeLogEventV1, ConcurrentMerkleTreeAccount, createAllocTreeIx, deserializeChangeLogEventV1, ValidDepthSizePair } from "@solana/spl-account-compression";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { base58, utf8 } from "@metaplex-foundation/umi/serializers";

describe("knowledge-manager", () => {

  const confirmTransaction = async (signature) => {
    const latestBlockHash = await connection.getLatestBlockhash();
    const lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;

    const confirmationStrategy: TransactionConfirmationStrategy = {
      signature: signature,
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: lastValidBlockHeight
    }

    return await connection.confirmTransaction(confirmationStrategy, 'finalized');
  }
  
  let programStateAccountInfo;
  let programStateData;
  let treeAccount: ConcurrentMerkleTreeAccount;
  let collection_mint: KeypairSigner;

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;

  const program = anchor.workspace.KnowledgeManager as Program<KnowledgeManager>;
  const connection = provider.connection;

  // Setup umi
  const umi = createUmi(connection.rpcEndpoint).use(mplTokenMetadata());

  const wallet_keypair = umi.eddsa.createKeypairFromSecretKey(wallet.payer.secretKey);
  let signer = createSignerFromKeypair(umi, wallet_keypair);

  umi.use(signerIdentity(signer));
  umi.use(dasApi());

  // Derive the PDA (tree_state) with the same seeds as the program
  let [programStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("knowledge")], // Same seed as in the Rust program
    program.programId
  );

  // Create merkle tree account
  const tree = Keypair.generate();

  // Derive tree owner account pda
  const [tree_owner] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode('tree_owner'),
      tree.publicKey.toBuffer(),
    ],
    program.programId
  );

  // Derive tree config account pda (owned by bubblegum program)
  let [tree_config] = PublicKey.findProgramAddressSync(
      [tree.publicKey.toBuffer()], // Same seed as in the Rust program
      new PublicKey(MPL_BUBBLEGUM_PROGRAM_ID)
  );

  console.log("Tree config:", tree_config);

  const [bubblegumSigner] = PublicKey.findProgramAddressSync(
    // `collection_cpi` is a custom prefix required by the Bubblegum program
    [Buffer.from('collection_cpi', 'utf8')],
    new anchor.web3.PublicKey(MPL_BUBBLEGUM_PROGRAM_ID)
  );

  // Define tree attributes
  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 14,
    maxBufferSize: 64,
  };
  const canopyDepth = maxDepthSizePair.maxDepth - 5;

  // Define metadata for NFT
  const metadata = {
    uri: 'https://arweave.net/h19GMcMz7RLDY7kAHGWeWolHTmO83mLLMNPzEkF32BQ',
    name: 'TEST-NFT',
    symbol: 'TNFT'
  }

  // Define metadata for NFT collection
  const metadataCollection = {
    uri: 'https://arweave.net/h19GMcMz7RLDY7kAHGWeWolHTmO83mLLMNPzEkF32BQ',
    name: 'TEST-COLLECTION-NFT',
    symbol: 'TCNFT'
  }

  before(async () => {
    // Close pda state account if it exists
    const programStateAccountInfo = await provider.connection.getAccountInfo(programStatePda);
    if (programStateAccountInfo) {
      const closeTx = await program.methods.closeStateAccount()
      .accounts({
        programState: programStatePda,
        receiver: wallet.payer.publicKey
      }).signers([wallet.payer]).rpc({ commitment: 'confirmed'});
    } 
    
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

    // Create collection mint
    collection_mint = generateSigner(umi);
    const createNftTx = await createNft(umi, {
      mint: collection_mint,
      sellerFeeBasisPoints: percentAmount(0),
      name: 'TEST-COLLECTION',
      uri: "TEST-COLLECTION-URI",
      isCollection: true
    }).sendAndConfirm(umi); 
    
    const createNftSignature = base58.deserialize(createNftTx.signature)[0];
    console.log(`https://explorer.solana.com/tx/${createNftSignature}?cluster=devnet`)
  
    const metadataAddress = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata", "utf8"),
        new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
        new PublicKey(collection_mint.publicKey).toBuffer()
      ],
      new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
    )[0];

    const updateNftUpdateAuthTx = await updateV1(umi, {
      mint: collection_mint.publicKey,
      authority: signer,
      newUpdateAuthority: tree_owner.toBase58() as UmiPK
    },).sendAndConfirm(umi);

    const updateNftUpdateAuthSignature = base58.deserialize(updateNftUpdateAuthTx.signature)[0];
    console.log(`https://explorer.solana.com/tx/${updateNftUpdateAuthSignature}?cluster=devnet`)

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
    programStateData = await program.account.programState.fetch(programStatePda);

    assert.strictEqual(
      programStateAccountInfo.owner.toString(),
      program.programId.toString(),
      "tree_state account is not owned by the program"
    );

    assert.strictEqual(
      programStateData.creator.toString(),
      "2gUrmvYsLTpXB5VwjP2ZpXD4kY4HWRP89aDzQQ7TKbwh",
      "unexpected creator");

    assert.strictEqual(
      programStateAccountInfo.data.length,
      46 + 1 * 64, // space = account disc (8) + pubkey (32) + vec size (4) + tree count (2) + max_#_trees * tree info (64)
      "tree_state account data size is incorrect"
    );
  });

  it("Creates an empty merkle tree", async () => {

    const tx = await program.methods
    .createTree(maxDepthSizePair.maxDepth, maxDepthSizePair.maxBufferSize)
    // Do not pass accounts that are automatically resolved
    .accounts({
      tree: tree.publicKey,
      treeConfig: tree_config,
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
    
    programStateData = await program.account.programState.fetch(programStatePda);
    assert.strictEqual(
      programStateData.treeCount,
      1,
      "Unexpected number of merkle trees");

  });

  it("Mints an NFT to an existing merkle tree", async () => {
    const leafOwner = Keypair.generate();

    assert.ok(treeAccount, "Tree account should exist before minting NFTs");
    
    const tx: TransactionSignature = await program.methods
    .mint(metadata.name, metadata.symbol, metadata.uri, 10)
    .accounts({
      payer: wallet.publicKey,
      tree: tree.publicKey,
      treeAuth: tree_config,
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
      leafIndex: leafIndex,
    });

    console.log("Leaf Index:", leafIndex);
    console.log("Tree pk:", tree.publicKey.toBase58());

    await confirmTransaction(tx);
    const rpcAsset = await umi.rpc.getAsset(assetId);

    console.log(`Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    console.log("NFT Name:", rpcAsset.content.metadata.name);

  });

  it("Mints an NFT to an existing merkle tree and collection", async () => {

    const fetchedNFT = await fetchDigitalAsset(umi, collection_mint.publicKey);

    const editionAccount = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata', 'utf8'),
        new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
        new PublicKey(fetchedNFT.publicKey).toBuffer(),
        Buffer.from('edition', 'utf8'),
      ],
      new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
    )[0];

    const metadataAccount = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata", "utf8"),
        new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
        new PublicKey(collection_mint.publicKey).toBuffer(),
      ],
      new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
    )[0];

    const tx = await program.methods
      .mintToCollection(metadata.name, metadata.symbol, metadata.uri, 0)
      .accounts({
        treeAuth: tree_config,
        leafOwner: wallet.publicKey,
        tree: tree.publicKey,
        collectionMint: fetchedNFT.publicKey,
        collectionMetadata: metadataAccount,
        bubblegumSigner: bubblegumSigner,
        editionAccount:  editionAccount,
      })
    .rpc({ commitment: 'confirmed' });
    await confirmTransaction(tx);
    console.log(`Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  });

});
