import { Keypair, PublicKey } from "@solana/web3.js";
import { program, provider } from "./setup";
import { MPL_BUBBLEGUM_PROGRAM_ID } from "@metaplex-foundation/mpl-bubblegum";
import { CreateCompressedNftOutput, CreateNftInput, keypairIdentity, Metaplex } from "@metaplex-foundation/js";
import { Wallet } from "@coral-xyz/anchor";

type ModelMetadata = {
    name: string;
    symbol: string;
    hash: string; //Override uri with model weights hash
}

type CollectionMetadata = {
    name: string;
    symbol: string;
    uri: string;
}

export const mintCNFT = async (leafOwner: Keypair, tree: PublicKey, metadata: ModelMetadata, collectionMetadata: CollectionMetadata) => {
    const wallet = provider.wallet as Wallet;

    let [treeConfig] = PublicKey.findProgramAddressSync(
          [tree.toBuffer()], // Same seed as in the Rust program
          new PublicKey(MPL_BUBBLEGUM_PROGRAM_ID)
      );

    const [bubblegumSigner] = PublicKey.findProgramAddressSync(
        // `collection_cpi` is a custom prefix required by the Bubblegum program
        [Buffer.from('collection_cpi', 'utf8')],
        new PublicKey(MPL_BUBBLEGUM_PROGRAM_ID)
    );

    // Initialize Collection NFT (optionally pass in an already created one, otherwise must specify the new one)
    const metaplex = Metaplex.make(provider.connection).use(keypairIdentity(wallet.payer));

    const collectionNFT: CreateCompressedNftOutput = await metaplex.nfts().create({
      uri: collectionMetadata.uri,
      name: collectionMetadata.name,
      symbol: collectionMetadata.symbol,
      sellerFeeBasisPoints: 0,
      isCollection: true,
    });
    
    // Mint model to collection (leafOwner should not pay, check who is paying)
    const tx = await program.methods
      .mintToCollection(metadata.name, metadata.symbol, metadata.hash, 0)
      .accounts({
        payer: wallet.payer.publicKey,
        treeAuth: treeConfig,
        leafOwner: leafOwner.publicKey,
        tree: tree,
        collectionMint: collectionNFT.mintAddress,
        collectionMetadata: collectionNFT.metadataAddress,
        bubblegumSigner: bubblegumSigner,
        editionAccount: collectionNFT.masterEditionAddress,
      })
    .rpc({ commitment: 'confirmed' });

    console.log(`Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
};