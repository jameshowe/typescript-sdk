import { ContractWrapper } from "./contract-wrapper";
import { IMintableERC721, IMulticall } from "contracts";
import { NFTMetadataOrUri, NFTMetadataOwner } from "../../schema";
import { TransactionResultWithId } from "../types";
import { uploadOrExtractURI } from "../../common/nft";
import { IStorage } from "../interfaces";
import { Erc721 } from "./erc-721";
import { Erc721BatchMintable } from "./erc-721-batch-mintable";
import { detectContractFeature } from "../../common";
import { FEATURE_NFT_MINTABLE } from "../../constants/erc721-features";
import { DetectableFeature } from "../interfaces/DetectableFeature";
import { TransferEvent } from "contracts/ITokenERC721";

/**
 * Mint ERC721 NFTs
 * @remarks NFT minting functionality that handles IPFS storage for you.
 * @example
 * ```javascript
 * const contract = await sdk.getContract("{{contract_address}}");
 * await contract.nft.mint.to(walletAddress, nftMetadata);
 * ```
 * @public
 */
export class Erc721Mintable implements DetectableFeature {
  featureName = FEATURE_NFT_MINTABLE.name;
  private contractWrapper: ContractWrapper<IMintableERC721>;
  private storage: IStorage;
  private erc721: Erc721;

  public batch: Erc721BatchMintable | undefined;

  constructor(
    erc721: Erc721,
    contractWrapper: ContractWrapper<IMintableERC721>,
    storage: IStorage,
  ) {
    this.erc721 = erc721;
    this.contractWrapper = contractWrapper;
    this.storage = storage;
    this.batch = this.detectErc721BatchMintable();
  }

  /**
   * Mint a unique NFT
   *
   * @remarks Mint a unique NFT to a specified wallet.
   *
   * @example
   * ```javascript
   * // Address of the wallet you want to mint the NFT to
   * const walletAddress = "{{wallet_address}}";
   *
   * // Custom metadata of the NFT, note that you can fully customize this metadata with other properties.
   * const metadata = {
   *   name: "Cool NFT",
   *   description: "This is a cool NFT",
   *   image: fs.readFileSync("path/to/image.png"), // This can be an image url or file
   * };
   *
   * const tx = await contract.nft.mint.to(walletAddress, metadata);
   * const receipt = tx.receipt; // the transaction receipt
   * const tokenId = tx.id; // the id of the NFT minted
   * const nft = await tx.data(); // (optional) fetch details of minted NFT
   * ```
   */
  public async to(
    to: string,
    metadata: NFTMetadataOrUri,
  ): Promise<TransactionResultWithId<NFTMetadataOwner>> {
    const uri = await uploadOrExtractURI(metadata, this.storage);
    const receipt = await this.contractWrapper.sendTransaction("mintTo", [
      to,
      uri,
    ]);
    const event = this.contractWrapper.parseLogs<TransferEvent>(
      "Transfer",
      receipt?.logs,
    );
    if (event.length === 0) {
      throw new Error("TokenMinted event not found");
    }
    const id = event[0].args.tokenId;
    return {
      id,
      receipt,
      data: () => this.erc721.get(id),
    };
  }

  private detectErc721BatchMintable(): Erc721BatchMintable | undefined {
    if (
      detectContractFeature<IMintableERC721 & IMulticall>(
        this.contractWrapper,
        "ERC721BatchMintable",
      )
    ) {
      return new Erc721BatchMintable(
        this.erc721,
        this.contractWrapper,
        this.storage,
      );
    }
    return undefined;
  }
}
