import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KnowledgeManager } from "../target/types/knowledge_manager";
import {
  findLeafAssetIdPda,
  MPL_BUBBLEGUM_PROGRAM_ID,
} from '@metaplex-foundation/mpl-bubblegum';
import { fetchDigitalAsset, mplTokenMetadata, updateV1, } from "@metaplex-foundation/mpl-token-metadata";
import { MPL_TOKEN_METADATA_PROGRAM_ID, createNft } from '@metaplex-foundation/mpl-token-metadata';
import { percentAmount, PublicKey as UmiPK, generateSigner, signerIdentity, createSignerFromKeypair, KeypairSigner, request } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { PublicKey, Keypair, TransactionConfirmationStrategy, Transaction, sendAndConfirmTransaction, TransactionSignature, SYSVAR_INSTRUCTIONS_PUBKEY,
  Ed25519Program } from "@solana/web3.js";
import { assert } from "chai";
import { ChangeLogEventV1, ConcurrentMerkleTreeAccount, createAllocTreeIx, deserializeChangeLogEventV1, ValidDepthSizePair } from "@solana/spl-account-compression";
import {  } from "@coral-xyz/anchor"
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { base58 } from "@metaplex-foundation/umi/serializers";
import * as borsh from "borsh";
import { execSync } from "child_process";
import nacl from 'tweetnacl';

describe("deinference", () => {

  const confirmTransaction = async (signature) => {
    console.log("Attempting to confirm transaction:", signature);
    const latestBlockHash = await connection.getLatestBlockhash();
    const lastValidBlockHeight = latestBlockHash.lastValidBlockHeight;

    const confirmationStrategy: TransactionConfirmationStrategy = {
      signature: signature,
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: lastValidBlockHeight
    }

    return await connection.confirmTransaction(confirmationStrategy, 'confirmed');
  }
  
  let programStateAccountInfo;
  let programStateData;
  let requestStatePda;
  let requestStateData;
  let collectionMetadataAccount: PublicKey;
  let treeAccount: ConcurrentMerkleTreeAccount;
  let collection_mint: KeypairSigner;
  let request_id: number = 0;

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

  // Derive the PDA (task_data)
  collection_mint = generateSigner(umi);
  let [taskDataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("collection123"),
      new PublicKey(collection_mint.publicKey).toBuffer()
    ],
    program.programId
  )

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

  // Derive bubblegum signer pda
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
    uri: '12345678901234567890123456789012', // Must be 32 bytes
    name: 'TEST-NFT',
    symbol: 'TNFT'
  }

  before(async () => {
    // Fund wallet (LOCAL NET ONLY)
    console.log('Running fund script...');
    execSync('anchor run fund -- 2gUrmvYsLTpXB5VwjP2ZpXD4kY4HWRP89aDzQQ7TKbwh 5', {
      stdio: 'inherit', // Pass output to the terminal
    });

    // Close state accounts if they already exist
    const programStateAccountInfo = await provider.connection.getAccountInfo(programStatePda);
    if (programStateAccountInfo) {
      const closeStateAccountTx = await program.methods.closeAccount()
      .accounts({
        pdaAccount: programStatePda,
        receiver: wallet.payer.publicKey
      }).signers([wallet.payer]).rpc({ commitment: 'confirmed'});
    }

    const taskDataStateAccountInfo = await provider.connection.getAccountInfo(taskDataPda);
    if (taskDataStateAccountInfo) {
      const closeTaskDataAccountTx = await program.methods.closeAccount()
      .accounts({
        pdaAccount: taskDataPda,
        receiver: wallet.payer.publicKey
      }).signers([wallet.payer]).rpc({ commitment: 'confirmed'});
    } 

    const request_id_buffer = Buffer.alloc(2);
    request_id_buffer.writeUInt16LE(request_id);
    [requestStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("request"), request_id_buffer], // Same seed as in the Rust program
      program.programId
    );

    const requestStateAccountInfo = await provider.connection.getAccountInfo(requestStatePda);
    if (requestStateAccountInfo) {
      console.log("Attempting to close request state");
      const closeRequestStateAccountTx = await program.methods.closeAccount()
      .accounts({
        pdaAccount: requestStatePda,
        receiver: wallet.payer.publicKey
      }).signers([wallet.payer]).rpc({ commitment: 'confirmed'});
      console.log("Request state account closed:", closeRequestStateAccountTx);
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
    const createNftTx = await createNft(umi, {
      mint: collection_mint,
      sellerFeeBasisPoints: percentAmount(0),
      name: 'TEST-COLLECTION',
      uri: "https://raw.githubusercontent.com/robertLam04/DEInference/main/example_task.json",
      isCollection: true
    }).sendAndConfirm(umi);
    
    const createNftSignature = base58.deserialize(createNftTx.signature)[0];
    console.log(`https://explorer.solana.com/tx/${createNftSignature}?cluster=devnet`)

    await confirmTransaction(createNftSignature);

    const updateNftUpdateAuthTx = await updateV1(umi, {
      mint: collection_mint.publicKey,
      newUpdateAuthority: tree_owner.toBase58() as UmiPK
    }).sendAndConfirm(umi);

    const updateNftUpdateAuthSignature = base58.deserialize(updateNftUpdateAuthTx.signature)[0];
    console.log(`https://explorer.solana.com/tx/${updateNftUpdateAuthSignature}?cluster=devnet`)

    // Derive collection metadata pda account
    collectionMetadataAccount = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata", "utf8"),
        new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
        new PublicKey(collection_mint.publicKey).toBuffer(),
      ],
      new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
    )[0];
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
      46 + 1 * 66, // space = account disc (8) + pubkey (32) + vec size (4) + tree count (2) + max_#_trees * tree info (66)
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
      "Unexpected number of merkle trees"
    );
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

  it("Initializes a new inference task collection", async () => {
    // Call the create_task instruction
    const tx = await program.methods
      .createTask().accounts({
        collectionMint: collection_mint.publicKey,
        metadata: collectionMetadataAccount,
        payer: wallet.publicKey,
      })
      .signers([wallet.payer]) 
    .rpc({commitment: 'confirmed'});

    await confirmTransaction(tx);
    console.log("create task ix:", tx)

    // Fetch the task_data account and assert it was initialized
    const taskDataAccountInfo = await provider.connection.getAccountInfo(taskDataPda);
    const taskDataAccount = await program.account.taskData.fetch(taskDataPda);
    assert.strictEqual(taskDataAccountInfo.data.length, 117);
    assert.ok(taskDataAccount.collectionMint.equals(new PublicKey(collection_mint.publicKey)));
  });

  it("Mints an NFT to an existing merkle tree and task (collection)", async () => {

    const editionAccount = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata', 'utf8'),
        new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID).toBuffer(),
        new PublicKey(collection_mint.publicKey).toBuffer(),
        Buffer.from('edition', 'utf8'),
      ],
      new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID)
    )[0];

    const signature = nacl.sign.detached(Buffer.from(metadata.uri), wallet.payer.secretKey);
    const ed25519Instruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: wallet.payer.publicKey.toBytes(),
      message: Buffer.from(metadata.uri),
      signature: signature
    });

    const tx = await program.methods
      .mintToTask(metadata.name, metadata.symbol, metadata.uri, Array.from(signature), 0)
      .accounts({
        treeAuth: tree_config,
        modelOwner: wallet.publicKey,
        tree: tree.publicKey,
        collectionMint: collection_mint.publicKey,
        collectionMetadata: collectionMetadataAccount,
        bubblegumSigner: bubblegumSigner,
        editionAccount:  editionAccount,
      }).preInstructions([ed25519Instruction]).signers([wallet.payer])
    .rpc({ commitment: 'confirmed' });
    await confirmTransaction(tx);
    console.log(`Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    
    programStateData = await program.account.programState.fetch(programStatePda);
    const taskData = await program.account.taskData.fetch(taskDataPda);

    assert.strictEqual(taskData.modelCount, 1);
    assert.deepEqual(taskData.models[0].weightsHash, Array.from(anchor.utils.bytes.utf8.encode(metadata.uri)));
  
  });

  it("Retrieves a model from task data and emits an event", async () => {
    const weightsHash = Array.from(anchor.utils.bytes.utf8.encode(metadata.uri));

    const listener = program.addEventListener("modelRetrieved", (event, slot) => {
      console.log("Event data:", event);
      console.log("Event slot:", slot);
  
      assert.strictEqual(event.leafIndex, 0);
      assert.strictEqual(event.reputation, 0);
      assert.deepEqual(event.treeAddress, tree.publicKey);
    });

    await program.methods.getModel(weightsHash)
      .accounts({
        payer: wallet.payer.publicKey,
        collectionMint: collection_mint.publicKey,
    }).rpc({commitment: 'confirmed'});

    await program.removeEventListener(listener);

  });

  it("Posts a new inference request and emits an event", async () => {
    type RustType = 'u64' | 'string' | 'bool';

    interface Field {
      name: string;
      type: RustType | { fields: Field[] };
    }

    // Fetch expected input struct from collection metadata
    const collection = await fetchDigitalAsset(umi, collection_mint.publicKey);
    console.log("uri: ", collection.metadata.uri);
    
    const json = await fetch(
      collection.metadata.uri
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        return response.json();
    });

    function createStruct(fields: Field[]): Record<string, any> {
      const structure: Record<string, any> = {};
    
      for (const field of fields) {
        if (typeof field.type === 'string') {
          // Primitive RustType
          structure[field.name] = field.type;
        } else if ('fields' in field.type) {
          // Nested fields, handle recursively
          structure[field.name] = createStruct(field.type.fields);
        }
      }
    
      return structure;
    }

    // Use this struct to build input prompt in frontend. Optionally allow a direct JSON input and check if structure matches.
    const input_struct = createStruct(json.format.fields);
    console.log("expected input format:", input_struct);

    class RequestData {
      param1: number;
      param2: number;
      name: string;
      constructor(fields) {
        this.param1 = fields.param1;
        this.param2 = fields.param2;
        this.name = fields.name;
      }
    }
    
    // Define the schema for Borsh serialization
    const schema = new Map([
      [
        RequestData,
        {
          kind: "struct",
          fields: [
            ["param1", "u32"],
            ["param2", "u32"],
            ["name", "string"],
          ],
        },
      ],
    ]);
    
    const requestData = new RequestData({
      param1: 1234,
      param2: 1234,
      name: 'test',
    });
    
    // Serialize into bytes
    const serializedData = borsh.serialize(schema, requestData);
    console.log("data length:", serializedData.length);

    const listener = program.addEventListener("request", (event, slot) => {
      assert.strictEqual(event.requestId, 0),
      assert.deepEqual(event.taskCollection, new PublicKey(collection_mint.publicKey));
      assert.ok(event.status.pending);
      assert.notOk(event.status.aggregated);
    });

    const tx = await program.methods.postRequest(request_id, Buffer.from(serializedData)).accounts({
      user: wallet.publicKey, // Use our wallet here as the user for simplicity (change later)
      collectionMint: collection_mint.publicKey
    }).signers([wallet.payer]).rpc({commitment: 'confirmed'});
    await confirmTransaction(tx);

    await program.removeEventListener(listener);
    
    requestStateData = await program.account.inferenceRequest.fetch(requestStatePda);
    assert.strictEqual(requestStateData.requestId, request_id);
  });

  it("Submits a prediction to an inference request with an already registered model", async () => {

    const model_weights = anchor.utils.bytes.utf8.encode(metadata.uri);
    const prediction = anchor.utils.bytes.utf8.encode("example_pred");

    const tx = await program.methods.
      submitPred(request_id, Array.from(model_weights), Buffer.from(prediction)).
      accounts({
        modelOwner: wallet.publicKey,
        collectionMint: collection_mint.publicKey
    }).signers([wallet.payer]).rpc({commitment: "confirmed"});
    await confirmTransaction(tx);

    requestStateData = await program.account.inferenceRequest.fetch(requestStatePda);
    console.log("request data pred results:", requestStateData.results);

  });
});
