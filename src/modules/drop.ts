import {
  ERC20__factory,
  LazyNFT as Drop,
  LazyNFT__factory as Drop__factory,
  LazyMintERC721 as DropV2,
  LazyMintERC721__factory as DropV2__factory,
} from "@3rdweb/contracts";
import { ClaimConditionStructOutput } from "@3rdweb/contracts/dist/LazyMintERC721";
import { PublicMintConditionStruct } from "@3rdweb/contracts/dist/LazyNFT";
import { hexZeroPad } from "@ethersproject/bytes";
import { AddressZero } from "@ethersproject/constants";
import { TransactionReceipt } from "@ethersproject/providers";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import { JsonConvert } from "json2typescript";
import {
  getCurrencyValue,
  isNativeToken,
  ModuleType,
  NATIVE_TOKEN_ADDRESS,
  Role,
  RolesMap,
} from "../common";
import { invariant } from "../common/invariant";
import { getTokenMetadata, NFTMetadata, NFTMetadataOwner } from "../common/nft";
import { ThirdwebSDK } from "../core";
import { ModuleWithRoles } from "../core/module";
import { MetadataURIOrObject, ProviderOrSigner } from "../core/types";
import ClaimConditionFactory from "../factories/ClaimConditionFactory";
import { ISDKOptions } from "../interfaces/ISdkOptions";
import {
  ClaimCondition,
  PublicMintCondition,
} from "../types/claim-conditions/PublicMintCondition";
import { DEFAULT_QUERY_ALL_COUNT, QueryAllParams } from "../types/QueryParams";
import { Snapshot } from "../types/snapshots/Snapshot";

/**
 * @beta
 */
export interface CreatePublicMintCondition {
  startTimestampInSeconds?: BigNumberish;
  maxMintSupply: BigNumberish;
  quantityLimitPerTransaction?: BigNumberish;
  waitTimeSecondsLimitPerTransaction?: BigNumberish;
  pricePerToken?: BigNumberish;
  currency?: string;
  merkleRoot?: BytesLike;
}

/**
 * Access this module by calling {@link ThirdwebSDK.getDropModule}
 * @beta
 */
export class DropModule extends ModuleWithRoles<DropV2> {
  private _shouldCheckVersion = true;
  private _isV1 = false;
  private v1Module: DropV1Module;

  public static moduleType: ModuleType = ModuleType.DROP;
  storage = this.sdk.getStorage();

  public static roles = [
    RolesMap.admin,
    RolesMap.minter,
    RolesMap.transfer,
  ] as const;

  /**
   * @internal
   */
  constructor(
    providerOrSigner: ProviderOrSigner,
    address: string,
    options: ISDKOptions,
    sdk: ThirdwebSDK,
  ) {
    super(providerOrSigner, address, options, sdk);
    this.v1Module = new DropV1Module(providerOrSigner, address, options, sdk);
  }

  /**
   * @internal
   */
  public setProviderOrSigner(providerOrSigner: ProviderOrSigner) {
    super.setProviderOrSigner(providerOrSigner);
    this.v1Module?.setProviderOrSigner(providerOrSigner);
  }

  /**
   * @override
   * @internal
   */
  protected getModuleRoles(): readonly Role[] {
    return DropModule.roles;
  }

  /**
   * @internal
   */
  protected connectContract(): DropV2 {
    return DropV2__factory.connect(this.address, this.providerOrSigner);
  }

  /**
   * @internal
   */
  protected getModuleType(): ModuleType {
    return DropModule.moduleType;
  }

  private async getTokenMetadata(tokenId: string): Promise<NFTMetadata> {
    return await getTokenMetadata(
      this.readOnlyContract,
      tokenId,
      this.ipfsGatewayUrl,
    );
  }

  public async get(tokenId: string): Promise<NFTMetadataOwner> {
    const [owner, metadata] = await Promise.all([
      this.ownerOf(tokenId).catch(() => AddressZero),
      this.getTokenMetadata(tokenId),
    ]);

    return { owner, metadata };
  }

  public async getAll(
    queryParams?: QueryAllParams,
  ): Promise<NFTMetadataOwner[]> {
    // if v1 module then use v1
    if (await this.isV1()) {
      return this.v1Module.getAll(queryParams);
    }
    const start = BigNumber.from(queryParams?.start || 0).toNumber();
    const count = BigNumber.from(
      queryParams?.count || DEFAULT_QUERY_ALL_COUNT,
    ).toNumber();
    const maxId = Math.min(
      (await this.readOnlyContract.nextTokenIdToMint()).toNumber(),
      start + count,
    );
    return await Promise.all(
      Array.from(Array(maxId - start).keys()).map((i) =>
        this.get((start + i).toString()),
      ),
    );
  }

  public async getAllUnclaimed(
    queryParams?: QueryAllParams,
  ): Promise<NFTMetadataOwner[]> {
    if (await this.isV1()) {
      return this.v1Module.getAllUnclaimed();
    }
    const start = BigNumber.from(queryParams?.start || 0).toNumber();
    const count = BigNumber.from(
      queryParams?.count || DEFAULT_QUERY_ALL_COUNT,
    ).toNumber();
    const maxId = BigNumber.from(
      Math.min(
        (await this.readOnlyContract.nextTokenIdToMint()).toNumber(),
        start + count,
      ),
    );
    const unmintedId = await this.readOnlyContract.nextTokenIdToClaim();
    return (
      await Promise.all(
        Array.from(Array(maxId.sub(unmintedId).toNumber()).keys()).map((i) =>
          this.getTokenMetadata(unmintedId.add(i).toString()),
        ),
      )
    ).map((metadata) => ({ owner: AddressZero, metadata }));
  }

  public async getAllClaimed(
    queryParams?: QueryAllParams,
  ): Promise<NFTMetadataOwner[]> {
    if (await this.isV1()) {
      return this.v1Module.getAllClaimed();
    }
    const start = BigNumber.from(queryParams?.start || 0).toNumber();
    const count = BigNumber.from(
      queryParams?.count || DEFAULT_QUERY_ALL_COUNT,
    ).toNumber();
    const maxId = Math.min(
      (await this.readOnlyContract.nextTokenIdToClaim()).toNumber(),
      start + count,
    );
    return await Promise.all(
      Array.from(Array(maxId).keys()).map((i) => this.get(i.toString())),
    );
  }

  public async ownerOf(tokenId: string): Promise<string> {
    return await this.readOnlyContract.ownerOf(tokenId);
  }

  public async getOwned(_address?: string): Promise<NFTMetadataOwner[]> {
    const address = _address ? _address : await this.getSignerAddress();
    const balance = await this.readOnlyContract.balanceOf(address);
    const indices = Array.from(Array(balance.toNumber()).keys());
    const tokenIds = await Promise.all(
      indices.map((i) => this.readOnlyContract.tokenOfOwnerByIndex(address, i)),
    );
    return await Promise.all(
      tokenIds.map((tokenId) => this.get(tokenId.toString())),
    );
  }

  /**
   * @deprecated - For backward compatibility reason
   */
  private transformResultToMintCondition(
    pm: ClaimConditionStructOutput,
  ): PublicMintCondition {
    return {
      startTimestamp: pm.startTimestamp,
      maxMintSupply: pm.maxClaimableSupply,
      currentMintSupply: pm.supplyClaimed,
      quantityLimitPerTransaction: pm.quantityLimitPerTransaction,
      waitTimeSecondsLimitPerTransaction: pm.waitTimeInSecondsBetweenClaims,
      pricePerToken: pm.pricePerToken,
      currency: pm.currency,
      merkleRoot: pm.merkleRoot,
    };
  }

  private async transformResultToClaimCondition(
    pm: ClaimConditionStructOutput,
  ): Promise<ClaimCondition> {
    const cv = await getCurrencyValue(
      this.providerOrSigner,
      pm.currency,
      pm.pricePerToken,
    );
    return {
      startTimestamp: new Date(
        BigNumber.from(pm.startTimestamp).toNumber() * 1000,
      ),
      maxMintSupply: pm.maxClaimableSupply.toString(),
      currentMintSupply: pm.supplyClaimed.toString(),
      availableSupply: BigNumber.from(pm.maxClaimableSupply)
        .sub(pm.supplyClaimed)
        .toString(),
      quantityLimitPerTransaction: pm.quantityLimitPerTransaction.toString(),
      waitTimeSecondsLimitPerTransaction:
        pm.waitTimeInSecondsBetweenClaims.toString(),
      price: BigNumber.from(pm.pricePerToken),
      pricePerToken: BigNumber.from(pm.pricePerToken),
      currency: pm.currency,
      currencyContract: pm.currency,
      currencyMetadata: cv,
      merkleRoot: pm.merkleRoot,
    };
  }

  /**
   * @deprecated - Use {@link DropModule.getActiveClaimCondition} instead
   */
  public async getActiveMintCondition(): Promise<PublicMintCondition> {
    if (await this.isV1()) {
      return this.v1Module.getActiveMintCondition();
    }
    const index = await this.readOnlyContract.getIndexOfActiveCondition();
    return this.transformResultToMintCondition(
      await this.readOnlyContract.getClaimConditionAtIndex(index),
    );
  }

  public async getActiveClaimCondition(): Promise<ClaimCondition> {
    if (await this.isV1()) {
      return this.v1Module.getActiveClaimCondition();
    }
    const index = await this.readOnlyContract.getIndexOfActiveCondition();
    const mc = await this.readOnlyContract.getClaimConditionAtIndex(index);
    return await this.transformResultToClaimCondition(mc);
  }

  /**
   * @deprecated - Use {@link DropModule.getAllClaimConditions} instead
   */
  public async getAllMintConditions(): Promise<PublicMintCondition[]> {
    if (await this.isV1()) {
      return this.v1Module.getAllMintConditions();
    }

    const claimCondition = await this.readOnlyContract.claimConditions();
    const count = claimCondition.totalConditionCount.toNumber();
    const conditions = [];

    for (let i = 0; i < count; i++) {
      conditions.push(
        this.transformResultToMintCondition(
          await this.readOnlyContract.getClaimConditionAtIndex(i),
        ),
      );
    }

    return conditions;
  }

  public async getAllClaimConditions(): Promise<ClaimCondition[]> {
    if (await this.isV1()) {
      return this.v1Module.getAllClaimConditions();
    }
    const claimCondition = await this.readOnlyContract.claimConditions();
    const count = claimCondition.totalConditionCount.toNumber();
    const conditions = [];
    for (let i = 0; i < count; i++) {
      conditions.push(await this.readOnlyContract.getClaimConditionAtIndex(i));
    }
    return Promise.all(
      conditions.map((c) => this.transformResultToClaimCondition(c)),
    );
  }

  public async totalSupply(): Promise<BigNumber> {
    if (await this.isV1()) {
      return this.v1Module.totalSupply();
    }
    return await this.readOnlyContract.nextTokenIdToMint();
  }

  /**
   * @internal
   */
  public async maxTotalSupply(): Promise<BigNumber> {
    if (await this.isV1()) {
      return this.v1Module.maxTotalSupply();
    }
    return await this.readOnlyContract.nextTokenIdToMint();
  }

  public async totalUnclaimedSupply(): Promise<BigNumber> {
    if (await this.isV1()) {
      return this.v1Module.totalUnclaimedSupply();
    }
    return (await this.readOnlyContract.nextTokenIdToMint()).sub(
      await this.totalClaimedSupply(),
    );
  }

  public async totalClaimedSupply(): Promise<BigNumber> {
    if (await this.isV1()) {
      return this.v1Module.totalClaimedSupply();
    }
    return await this.readOnlyContract.nextTokenIdToClaim();
  }

  public async balanceOf(address: string): Promise<BigNumber> {
    return await this.readOnlyContract.balanceOf(address);
  }

  public async balance(): Promise<BigNumber> {
    return await this.balanceOf(await this.getSignerAddress());
  }

  public async isApproved(address: string, operator: string): Promise<boolean> {
    return await this.readOnlyContract.isApprovedForAll(address, operator);
  }

  // write functions
  public async setApproval(
    operator: string,
    approved = true,
  ): Promise<TransactionReceipt> {
    return await this.sendTransaction("setApprovalForAll", [
      operator,
      approved,
    ]);
  }

  public async transfer(
    to: string,
    tokenId: string,
  ): Promise<TransactionReceipt> {
    const from = await this.getSignerAddress();
    return await this.sendTransaction(
      "safeTransferFrom(address,address,uint256)",
      [from, to, tokenId],
    );
  }

  /**
   * @deprecated - The function has been deprecated. Use `createBatch` instead.
   */
  public async lazyMint(metadata: MetadataURIOrObject) {
    if (await this.isV1()) {
      await this.v1Module.lazyMint(metadata);
      return;
    }
    await this.lazyMintBatch([metadata]);
  }

  /**
   * @deprecated - The function has been deprecated. Use `mintBatch` instead.
   */
  public async lazyMintBatch(metadatas: MetadataURIOrObject[]) {
    if (await this.isV1()) {
      await this.v1Module.lazyMintBatch(metadatas);
      return;
    }
    await this.createBatch(metadatas);
  }

  /**
   * @deprecated - Use {@link DropModule.setClaimConditions} instead
   */
  public async setMintConditions(factory: ClaimConditionFactory) {
    if (await this.isV1()) {
      return this.v1Module.setMintConditions(factory);
    }
    return this.setClaimConditions(factory);
  }

  /**
   * Sets public mint conditions for the next minting using the
   * claim condition factory.
   *
   * @param factory - The claim condition factory.
   */
  public async setClaimConditions(factory: ClaimConditionFactory) {
    if (await this.isV1()) {
      return this.v1Module.setClaimConditions(factory);
    }
    const conditions = factory.buildConditions().map((c) => ({
      startTimestamp: c.startTimestamp,
      maxClaimableSupply: c.maxMintSupply,
      supplyClaimed: 0,
      quantityLimitPerTransaction: c.quantityLimitPerTransaction,
      waitTimeInSecondsBetweenClaims: c.waitTimeSecondsLimitPerTransaction,
      pricePerToken: c.pricePerToken,
      currency: c.currency === AddressZero ? NATIVE_TOKEN_ADDRESS : c.currency,
      merkleRoot: c.merkleRoot,
    }));

    const merkleInfo: { [key: string]: string } = {};
    factory.allSnapshots().forEach((s) => {
      merkleInfo[s.merkleRoot] = s.snapshotUri;
    });
    const { metadata } = await this.getMetadata(false);
    invariant(metadata, "Metadata is not set, this should never happen");
    if (factory.allSnapshots().length === 0 && "merkle" in metadata) {
      metadata["merkle"] = {};
    } else {
      metadata["merkle"] = merkleInfo;
    }

    const metatdataUri = await this.storage.upload(JSON.stringify(metadata));

    const encoded = [
      this.contract.interface.encodeFunctionData("setContractURI", [
        metatdataUri,
      ]),
      this.contract.interface.encodeFunctionData("setClaimConditions", [
        conditions,
      ]),
    ];
    return await this.sendTransaction("multicall", [encoded]);
  }

  /**
   * Creates a claim condition factory
   *
   * @returns - A new claim condition factory
   */
  public getClaimConditionsFactory(): ClaimConditionFactory {
    const createSnapshotFunc = this.sdk.createSnapshot.bind(this.sdk);
    const factory = new ClaimConditionFactory(createSnapshotFunc);
    return factory;
  }

  /**
   * @deprecated - Use the {@link DropModule.getClaimConditionsFactory} instead.
   */
  public getMintConditionsFactory(): ClaimConditionFactory {
    return this.getClaimConditionsFactory();
  }

  /**
   * @deprecated - Use the {@link DropModule.setClaimConditions} instead.
   */
  public async setPublicMintConditions(
    conditions: CreatePublicMintCondition[],
  ) {
    if (await this.isV1()) {
      return this.v1Module.setPublicMintConditions(conditions);
    }
    const now = BigNumber.from(Date.now()).div(1000);
    const _conditions = conditions.map((c) => ({
      startTimestamp: now.add(c.startTimestampInSeconds || 0),
      maxClaimableSupply: c.maxMintSupply,
      supplyClaimed: 0,
      quantityLimitPerTransaction:
        c.quantityLimitPerTransaction || c.maxMintSupply,
      waitTimeInSecondsBetweenClaims: c.waitTimeSecondsLimitPerTransaction || 0,
      pricePerToken: c.pricePerToken || 0,
      currency: c.currency || AddressZero,
      merkleRoot: c.merkleRoot || hexZeroPad([0], 32),
    }));
    await this.sendTransaction("setClaimConditions", [_conditions]);
  }

  public async canClaim(
    quantity: BigNumberish,
    proofs: BytesLike[] = [hexZeroPad([0], 32)],
  ): Promise<boolean> {
    if (await this.isV1()) {
      return this.v1Module.canClaim(quantity, proofs);
    }
    try {
      const mintCondition = await this.getActiveClaimCondition();
      const overrides = (await this.getCallOverrides()) || {};
      if (mintCondition.pricePerToken.gt(0)) {
        if (isNativeToken(mintCondition.currency)) {
          overrides["value"] = BigNumber.from(mintCondition.pricePerToken).mul(
            quantity,
          );
        } else {
          const erc20 = ERC20__factory.connect(
            mintCondition.currency,
            this.providerOrSigner,
          );
          const owner = await this.getSignerAddress();
          const spender = this.address;
          const allowance = await erc20.allowance(owner, spender);
          const totalPrice = BigNumber.from(mintCondition.pricePerToken).mul(
            BigNumber.from(quantity),
          );

          if (allowance.lt(totalPrice)) {
            // TODO throw allowance error, maybe check balance?
          }
        }
      }
      await this.readOnlyContract.callStatic.claim(quantity, proofs, overrides);
      return true;
    } catch (err) {
      return false;
    }
  }

  public async claim(
    quantity: BigNumberish,
    proofs: BytesLike[] = [hexZeroPad([0], 32)],
  ): Promise<NFTMetadataOwner[]> {
    if (await this.isV1()) {
      return this.v1Module.claim(quantity, proofs);
    }
    const mintCondition = await this.getActiveClaimCondition();
    const { metadata } = await this.getMetadata();

    const addressToClaim = await this.getSignerAddress();

    if (!mintCondition.merkleRoot.toString().startsWith(AddressZero)) {
      const snapshot = await this.storage.get(
        metadata?.merkle[mintCondition.merkleRoot.toString()],
      );
      const jsonConvert = new JsonConvert();
      const snapshotData = jsonConvert.deserializeObject(
        JSON.parse(snapshot),
        Snapshot,
      );
      const item = snapshotData.claims.find(
        (c) => c.address === addressToClaim,
      );
      if (item === undefined) {
        throw new Error("No claim found for this address");
      }
      proofs = item.proof;
    }

    const overrides = (await this.getCallOverrides()) || {};
    if (mintCondition.pricePerToken.gt(0)) {
      if (isNativeToken(mintCondition.currency)) {
        overrides["value"] = BigNumber.from(mintCondition.pricePerToken).mul(
          quantity,
        );
      } else {
        const erc20 = ERC20__factory.connect(
          mintCondition.currency,
          this.providerOrSigner,
        );
        const owner = await this.getSignerAddress();
        const spender = this.address;
        const allowance = await erc20.allowance(owner, spender);
        const totalPrice = BigNumber.from(mintCondition.pricePerToken).mul(
          BigNumber.from(quantity),
        );

        if (allowance.lt(totalPrice)) {
          await this.sendContractTransaction(erc20, "approve", [
            spender,
            allowance.add(totalPrice),
          ]);
        }
      }
    }

    const receipt = await this.sendTransaction(
      "claim",
      [quantity, proofs],
      overrides,
    );
    const event = this.parseEventLogs("ClaimedTokens", receipt?.logs);
    const startingIndex: BigNumber = event.startTokenId;
    const endingIndex = startingIndex.add(quantity);
    const tokenIds = [];
    for (let i = startingIndex; i.lt(endingIndex); i = i.add(1)) {
      tokenIds.push(BigNumber.from(i.toString()));
    }
    return await Promise.all(
      tokenIds.map(async (t) => await this.get(t.toString())),
    );
  }

  public async burn(tokenId: BigNumberish): Promise<TransactionReceipt> {
    return await this.sendTransaction("burn", [tokenId]);
  }

  public async transferFrom(
    from: string,
    to: string,
    tokenId: BigNumberish,
  ): Promise<TransactionReceipt> {
    return await this.sendTransaction("transferFrom", [from, to, tokenId]);
  }

  // owner functions
  public async setModuleMetadata(
    metadata: MetadataURIOrObject,
  ): Promise<TransactionReceipt> {
    const uri = await this.storage.uploadMetadata(metadata);
    return await this.sendTransaction("setContractURI", [uri]);
  }

  public async setRoyaltyBps(amount: number): Promise<TransactionReceipt> {
    // TODO: reduce this duplication and provide common functions around
    // royalties through an interface. Currently this function is
    // duplicated across 4 modules
    const { metadata } = await this.getMetadata();
    const encoded: string[] = [];
    if (!metadata) {
      throw new Error("No metadata found, this module might be invalid!");
    }

    metadata.seller_fee_basis_points = amount;
    const uri = await this.storage.uploadMetadata(
      {
        ...metadata,
      },
      this.address,
      await this.getSignerAddress(),
    );
    encoded.push(
      this.contract.interface.encodeFunctionData("setRoyaltyBps", [amount]),
    );
    encoded.push(
      this.contract.interface.encodeFunctionData("setContractURI", [uri]),
    );
    return await this.sendTransaction("multicall", [encoded]);
  }

  public async setRestrictedTransfer(
    restricted: boolean,
  ): Promise<TransactionReceipt> {
    return await this.sendTransaction("setRestrictedTransfer", [restricted]);
  }

  /**
   * Gets the royalty BPS (basis points) of the contract
   *
   * @returns - The royalty BPS
   */
  public async getRoyaltyBps(): Promise<BigNumberish> {
    return await this.readOnlyContract.royaltyBps();
  }

  /**
   * Gets the address of the royalty recipient
   *
   * @returns - The royalty BPS
   */
  public async getRoyaltyRecipientAddress(): Promise<string> {
    const metadata = await this.getMetadata();
    if (metadata.metadata?.fee_recipient !== undefined) {
      return metadata.metadata.fee_recipient;
    }
    return "";
  }

  /**
   * Create batch allows you to create a batch of tokens
   * in one transaction. This function can only be called
   * once per module at the moment.
   *
   * @beta
   *
   * @param metadatas - The metadata to include in the batch.
   */
  public async createBatch(
    metadatas: MetadataURIOrObject[],
  ): Promise<string[]> {
    if (await this.isV1()) {
      return this.v1Module.createBatch(metadatas);
    }
    const startFileNumber = await this.readOnlyContract.nextTokenIdToMint();
    const baseUri = await this.storage.uploadMetadataBatch(
      metadatas,
      this.address,
      startFileNumber.toNumber(),
    );
    const receipt = await this.sendTransaction("lazyMint", [
      metadatas.length,
      baseUri,
    ]);
    const event = this.parseEventLogs("LazyMintedTokens", receipt?.logs);
    const [startingIndex, endingIndex]: BigNumber[] = event;
    const tokenIds = [];
    for (let i = startingIndex; i.lte(endingIndex); i = i.add(1)) {
      tokenIds.push(i.toString());
    }
    return tokenIds;
  }

  /**
   * @internal
   *
   * @returns - True if the batch has been created, false otherwise.
   */
  public async canCreateBatch(): Promise<boolean> {
    if (await this.isV1()) {
      return this.v1Module.canCreateBatch();
    }
    return true;
  }

  /**
   * Check if contract is v1 or v2. If the contract doesn't have nextTokenIdToMint = v1 contract.
   */
  async isV1(): Promise<boolean> {
    if (this._shouldCheckVersion) {
      try {
        await this.readOnlyContract.nextTokenIdToMint();
        this._isV1 = false;
      } catch (e) {
        this._isV1 = true;
      }
      this._shouldCheckVersion = false;
    }
    return this._isV1;
  }
}

/**
 * @internal
 * @deprecated - Should use DropV2
 */
class DropV1Module extends ModuleWithRoles<Drop> {
  public static moduleType: ModuleType = ModuleType.DROP;
  storage = this.sdk.getStorage();

  public static roles = [
    RolesMap.admin,
    RolesMap.minter,
    RolesMap.transfer,
  ] as const;

  /**
   * @override
   * @internal
   */
  protected getModuleRoles(): readonly Role[] {
    return DropModule.roles;
  }

  /**
   * @internal
   */
  protected connectContract(): Drop {
    return Drop__factory.connect(this.address, this.providerOrSigner);
  }

  /**
   * @internal
   */
  protected getModuleType(): ModuleType {
    return DropModule.moduleType;
  }

  private async getTokenMetadata(tokenId: string): Promise<NFTMetadata> {
    return await getTokenMetadata(
      this.readOnlyContract,
      tokenId,
      this.ipfsGatewayUrl,
    );
  }

  public async get(tokenId: string): Promise<NFTMetadataOwner> {
    const [owner, metadata] = await Promise.all([
      this.ownerOf(tokenId).catch(() => AddressZero),
      this.getTokenMetadata(tokenId),
    ]);

    return { owner, metadata };
  }

  public async getAll(
    queryParams?: QueryAllParams,
  ): Promise<NFTMetadataOwner[]> {
    const start = BigNumber.from(queryParams?.start || 0).toNumber();
    const count = BigNumber.from(
      queryParams?.count || DEFAULT_QUERY_ALL_COUNT,
    ).toNumber();
    const maxId = Math.min(
      (await this.readOnlyContract.nextTokenId()).toNumber(),
      start + count,
    );
    return await Promise.all(
      Array.from(Array(maxId - start).keys()).map((i) =>
        this.get((start + i).toString()),
      ),
    );
  }

  public async getAllUnclaimed(
    queryParams?: QueryAllParams,
  ): Promise<NFTMetadataOwner[]> {
    const start = BigNumber.from(queryParams?.start || 0).toNumber();
    const count = BigNumber.from(
      queryParams?.count || DEFAULT_QUERY_ALL_COUNT,
    ).toNumber();
    const maxId = BigNumber.from(
      Math.min(
        (await this.readOnlyContract.nextTokenId()).toNumber(),
        start + count,
      ),
    );
    const unmintedId = await this.readOnlyContract.nextMintTokenId();
    return (
      await Promise.all(
        Array.from(Array(maxId.sub(unmintedId).toNumber()).keys()).map((i) =>
          this.getTokenMetadata(unmintedId.add(i).toString()),
        ),
      )
    ).map((metadata) => ({ owner: AddressZero, metadata }));
  }

  public async getAllClaimed(
    queryParams?: QueryAllParams,
  ): Promise<NFTMetadataOwner[]> {
    const start = BigNumber.from(queryParams?.start || 0).toNumber();
    const count = BigNumber.from(
      queryParams?.count || DEFAULT_QUERY_ALL_COUNT,
    ).toNumber();
    const maxId = Math.min(
      (await this.readOnlyContract.nextMintTokenId()).toNumber(),
      start + count,
    );
    return await Promise.all(
      Array.from(Array(maxId).keys()).map((i) => this.get(i.toString())),
    );
  }

  public async ownerOf(tokenId: string): Promise<string> {
    return await this.readOnlyContract.ownerOf(tokenId);
  }

  public async getOwned(_address?: string): Promise<NFTMetadataOwner[]> {
    const address = _address ? _address : await this.getSignerAddress();
    const balance = await this.readOnlyContract.balanceOf(address);
    const indices = Array.from(Array(balance.toNumber()).keys());
    const tokenIds = await Promise.all(
      indices.map((i) => this.readOnlyContract.tokenOfOwnerByIndex(address, i)),
    );
    return await Promise.all(
      tokenIds.map((tokenId) => this.get(tokenId.toString())),
    );
  }

  private async transformResultToClaimCondition(
    pm: PublicMintConditionStruct,
  ): Promise<ClaimCondition> {
    const cv = await getCurrencyValue(
      this.providerOrSigner,
      pm.currency,
      pm.pricePerToken,
    );
    return {
      startTimestamp: new Date(
        BigNumber.from(pm.startTimestamp).toNumber() * 1000,
      ),
      maxMintSupply: pm.maxMintSupply.toString(),
      currentMintSupply: pm.currentMintSupply.toString(),
      availableSupply: BigNumber.from(pm.maxMintSupply)
        .sub(pm.currentMintSupply)
        .toString(),
      quantityLimitPerTransaction: pm.quantityLimitPerTransaction.toString(),
      waitTimeSecondsLimitPerTransaction:
        pm.waitTimeSecondsLimitPerTransaction.toString(),
      price: BigNumber.from(pm.pricePerToken),
      pricePerToken: BigNumber.from(pm.pricePerToken),
      currency: pm.currency,
      currencyContract: pm.currency,
      currencyMetadata: cv,
      merkleRoot: pm.merkleRoot,
    };
  }

  /**
   * @deprecated - Use {@link DropModule.getActiveClaimCondition} instead
   */
  public async getActiveMintCondition(): Promise<PublicMintCondition> {
    const index =
      await this.readOnlyContract.getLastStartedMintConditionIndex();
    return await this.readOnlyContract.mintConditions(index);
  }

  public async getActiveClaimCondition(): Promise<ClaimCondition> {
    const index =
      await this.readOnlyContract.getLastStartedMintConditionIndex();
    const mc = await this.readOnlyContract.mintConditions(index);
    return await this.transformResultToClaimCondition(mc);
  }

  /**
   * @deprecated - Use {@link DropModule.getAllClaimConditions} instead
   */
  public async getAllMintConditions(): Promise<PublicMintCondition[]> {
    const conditions = [];
    for (let i = 0; ; i++) {
      try {
        conditions.push(await this.readOnlyContract.mintConditions(i));
      } catch (e) {
        break;
      }
    }
    return conditions;
  }

  public async getAllClaimConditions(): Promise<ClaimCondition[]> {
    const conditions = [];
    for (let i = 0; ; i++) {
      try {
        const mc = await this.readOnlyContract.mintConditions(i);
        conditions.push(await this.transformResultToClaimCondition(mc));
      } catch (e) {
        break;
      }
    }
    return conditions;
  }

  public async totalSupply(): Promise<BigNumber> {
    return await this.readOnlyContract.nextTokenId();
  }

  public async maxTotalSupply(): Promise<BigNumber> {
    return await this.readOnlyContract.maxTotalSupply();
  }

  public async totalUnclaimedSupply(): Promise<BigNumber> {
    return (await this.readOnlyContract.nextTokenId()).sub(
      await this.totalClaimedSupply(),
    );
  }

  public async totalClaimedSupply(): Promise<BigNumber> {
    return await this.readOnlyContract.nextMintTokenId();
  }

  public async balanceOf(address: string): Promise<BigNumber> {
    return await this.readOnlyContract.balanceOf(address);
  }

  public async balance(): Promise<BigNumber> {
    return await this.balanceOf(await this.getSignerAddress());
  }
  public async isApproved(address: string, operator: string): Promise<boolean> {
    return await this.readOnlyContract.isApprovedForAll(address, operator);
  }

  // write functions
  public async setApproval(
    operator: string,
    approved = true,
  ): Promise<TransactionReceipt> {
    return await this.sendTransaction("setApprovalForAll", [
      operator,
      approved,
    ]);
  }

  public async transfer(
    to: string,
    tokenId: string,
  ): Promise<TransactionReceipt> {
    const from = await this.getSignerAddress();
    return await this.sendTransaction(
      "safeTransferFrom(address,address,uint256)",
      [from, to, tokenId],
    );
  }

  /**
   * @deprecated - The function has been deprecated. Use `createBatch` instead.
   */
  public async lazyMint(metadata: MetadataURIOrObject) {
    await this.lazyMintBatch([metadata]);
  }

  public async pinToIpfs(files: Buffer[]): Promise<string> {
    return await this.storage.uploadBatch(files, this.address);
  }

  /**
   * @deprecated - The function has been deprecated. Use `mintBatch` instead.
   */
  public async lazyMintBatch(metadatas: MetadataURIOrObject[]) {
    const uris = await Promise.all(
      metadatas.map((m) => this.storage.uploadMetadata(m)),
    );
    await this.sendTransaction("lazyMintBatch", [uris]);
  }

  /**
   * @deprecated - The function has been deprecated. Use `mintBatch` instead.
   */
  public async lazyMintAmount(amount: BigNumberish) {
    await this.sendTransaction("lazyMintAmount", [amount]);
  }

  /**
   * @deprecated - Use {@link DropModule.setClaimConditions} instead
   */
  public async setMintConditions(factory: ClaimConditionFactory) {
    return this.setClaimConditions(factory);
  }

  /**
   * Sets public mint conditions for the next minting using the
   * claim condition factory.
   *
   * @param factory - The claim condition factory.
   */
  public async setClaimConditions(factory: ClaimConditionFactory) {
    const conditions = factory.buildConditionsForDropV1();

    const merkleInfo: { [key: string]: string } = {};
    factory.allSnapshots().forEach((s) => {
      merkleInfo[s.merkleRoot] = s.snapshotUri;
    });
    const { metadata } = await this.getMetadata(false);
    invariant(metadata, "Metadata is not set, this should never happen");
    if (factory.allSnapshots().length === 0 && "merkle" in metadata) {
      metadata["merkle"] = {};
    } else {
      metadata["merkle"] = merkleInfo;
    }

    const metatdataUri = await this.storage.upload(JSON.stringify(metadata));

    const encoded = [
      this.contract.interface.encodeFunctionData("setContractURI", [
        metatdataUri,
      ]),
      this.contract.interface.encodeFunctionData("setPublicMintConditions", [
        conditions,
      ]),
    ];
    return await this.sendTransaction("multicall", [encoded]);
  }

  /**
   * Creates a claim condition factory
   *
   * @returns - A new claim condition factory
   */
  public getClaimConditionsFactory(): ClaimConditionFactory {
    const createSnapshotFunc = this.sdk.createSnapshot.bind(this.sdk);
    const factory = new ClaimConditionFactory(createSnapshotFunc);
    return factory;
  }

  /**
   * @deprecated - Use the {@link DropModule.getClaimConditionsFactory} instead.
   */
  public getMintConditionsFactory(): ClaimConditionFactory {
    return this.getClaimConditionsFactory();
  }

  /**
   * @deprecated - Use the {@link DropModule.setClaimConditions} instead.
   */
  public async setPublicMintConditions(
    conditions: CreatePublicMintCondition[],
  ) {
    const _conditions = conditions.map((c) => ({
      startTimestamp: c.startTimestampInSeconds || 0,
      maxMintSupply: c.maxMintSupply,
      currentMintSupply: 0,
      quantityLimitPerTransaction:
        c.quantityLimitPerTransaction || c.maxMintSupply,
      waitTimeSecondsLimitPerTransaction:
        c.waitTimeSecondsLimitPerTransaction || 0,
      pricePerToken: c.pricePerToken || 0,
      currency: c.currency || AddressZero,
      merkleRoot: c.merkleRoot || hexZeroPad([0], 32),
    }));
    await this.sendTransaction("setPublicMintConditions", [_conditions]);
  }

  public async canClaim(
    quantity: BigNumberish,
    proofs: BytesLike[] = [hexZeroPad([0], 32)],
  ): Promise<boolean> {
    try {
      const mintCondition = await this.getActiveClaimCondition();
      const overrides = (await this.getCallOverrides()) || {};
      if (mintCondition.pricePerToken.gt(0)) {
        if (mintCondition.currency === AddressZero) {
          overrides["value"] = BigNumber.from(mintCondition.pricePerToken).mul(
            quantity,
          );
        } else {
          const erc20 = ERC20__factory.connect(
            mintCondition.currency,
            this.providerOrSigner,
          );
          const owner = await this.getSignerAddress();
          const spender = this.address;
          const allowance = await erc20.allowance(owner, spender);
          const totalPrice = BigNumber.from(mintCondition.pricePerToken).mul(
            BigNumber.from(quantity),
          );

          if (allowance.lt(totalPrice)) {
            // TODO throw allowance error, maybe check balance?
          }
        }
      }
      await this.readOnlyContract.callStatic.claim(quantity, proofs, overrides);
      return true;
    } catch (err) {
      return false;
    }
  }

  public async claim(
    quantity: BigNumberish,
    proofs: BytesLike[] = [hexZeroPad([0], 32)],
  ): Promise<NFTMetadataOwner[]> {
    const mintCondition = await this.getActiveClaimCondition();
    const { metadata } = await this.getMetadata();

    const addressToClaim = await this.getSignerAddress();

    if (!mintCondition.merkleRoot.toString().startsWith(AddressZero)) {
      const snapshot = await this.storage.get(
        metadata?.merkle[mintCondition.merkleRoot.toString()],
      );
      const jsonConvert = new JsonConvert();
      const snapshotData = jsonConvert.deserializeObject(
        JSON.parse(snapshot),
        Snapshot,
      );
      const item = snapshotData.claims.find(
        (c) => c.address === addressToClaim,
      );
      if (item === undefined) {
        throw new Error("No claim found for this address");
      }
      proofs = item.proof;
    }

    const overrides = (await this.getCallOverrides()) || {};
    if (mintCondition.pricePerToken.gt(0)) {
      if (mintCondition.currency === AddressZero) {
        overrides["value"] = BigNumber.from(mintCondition.pricePerToken).mul(
          quantity,
        );
      } else {
        const erc20 = ERC20__factory.connect(
          mintCondition.currency,
          this.providerOrSigner,
        );
        const owner = await this.getSignerAddress();
        const spender = this.address;
        const allowance = await erc20.allowance(owner, spender);
        const totalPrice = BigNumber.from(mintCondition.pricePerToken).mul(
          BigNumber.from(quantity),
        );

        if (allowance.lt(totalPrice)) {
          await this.sendContractTransaction(erc20, "approve", [
            spender,
            allowance.add(totalPrice),
          ]);
        }
      }
    }

    const receipt = await this.sendTransaction(
      "claim",
      [quantity, proofs],
      overrides,
    );
    const event = this.parseEventLogs("Claimed", receipt?.logs);
    const startingIndex: BigNumber = event.startTokenId;
    const endingIndex = startingIndex.add(quantity);
    const tokenIds = [];
    for (let i = startingIndex; i.lt(endingIndex); i = i.add(1)) {
      tokenIds.push(BigNumber.from(i.toString()));
    }
    return await Promise.all(
      tokenIds.map(async (t) => await this.get(t.toString())),
    );
  }

  public async burn(tokenId: BigNumberish): Promise<TransactionReceipt> {
    return await this.sendTransaction("burn", [tokenId]);
  }

  public async transferFrom(
    from: string,
    to: string,
    tokenId: BigNumberish,
  ): Promise<TransactionReceipt> {
    return await this.sendTransaction("transferFrom", [from, to, tokenId]);
  }

  // owner functions
  public async setModuleMetadata(
    metadata: MetadataURIOrObject,
  ): Promise<TransactionReceipt> {
    const uri = await this.storage.uploadMetadata(metadata);
    return await this.sendTransaction("setContractURI", [uri]);
  }

  public async setRoyaltyBps(amount: number): Promise<TransactionReceipt> {
    // TODO: reduce this duplication and provide common functions around
    // royalties through an interface. Currently this function is
    // duplicated across 4 modules
    const { metadata } = await this.getMetadata();
    const encoded: string[] = [];
    if (!metadata) {
      throw new Error("No metadata found, this module might be invalid!");
    }

    metadata.seller_fee_basis_points = amount;
    const uri = await this.storage.uploadMetadata(
      {
        ...metadata,
      },
      this.address,
      await this.getSignerAddress(),
    );
    encoded.push(
      this.contract.interface.encodeFunctionData("setRoyaltyBps", [amount]),
    );
    encoded.push(
      this.contract.interface.encodeFunctionData("setContractURI", [uri]),
    );
    return await this.sendTransaction("multicall", [encoded]);
  }

  public async setBaseTokenUri(uri: string): Promise<TransactionReceipt> {
    return await this.sendTransaction("setBaseTokenURI", [uri]);
  }

  public async setMaxTotalSupply(
    amount: BigNumberish,
  ): Promise<TransactionReceipt> {
    return await this.sendTransaction("setMaxTotalSupply", [amount]);
  }

  public async setRestrictedTransfer(
    restricted: boolean,
  ): Promise<TransactionReceipt> {
    return await this.sendTransaction("setRestrictedTransfer", [restricted]);
  }

  /**
   * Gets the royalty BPS (basis points) of the contract
   *
   * @returns - The royalty BPS
   */
  public async getRoyaltyBps(): Promise<BigNumberish> {
    return await this.readOnlyContract.royaltyBps();
  }

  /**
   * Gets the address of the royalty recipient
   *
   * @returns - The royalty BPS
   */
  public async getRoyaltyRecipientAddress(): Promise<string> {
    const metadata = await this.getMetadata();
    if (metadata.metadata?.fee_recipient !== undefined) {
      return metadata.metadata.fee_recipient;
    }
    return "";
  }

  /**
   * Create batch allows you to create a batch of tokens
   * in one transaction. This function can only be called
   * once per module at the moment.
   *
   * @beta
   *
   * @param metadatas - The metadata to include in the batch.
   */
  public async createBatch(
    metadatas: MetadataURIOrObject[],
  ): Promise<string[]> {
    if (!(await this.canCreateBatch())) {
      throw new Error("Batch already created!");
    }

    const startFileNumber = await this.readOnlyContract.nextMintTokenId();
    const baseUri = await this.storage.uploadMetadataBatch(
      metadatas,
      this.address,
      startFileNumber.toNumber(),
    );
    const encoded = [
      this.contract.interface.encodeFunctionData("setBaseTokenURI", [baseUri]),
      this.contract.interface.encodeFunctionData("lazyMintAmount", [
        metadatas.length,
      ]),
    ];
    await this.sendTransaction("multicall", [encoded]);
    return [];
  }

  /**
   * @internal
   *
   * @returns - True if the batch has been created, false otherwise.
   */
  public async canCreateBatch(): Promise<boolean> {
    return (await this.readOnlyContract.nextTokenId()).eq(0);
  }
}
// This is a deprecated class, DropV1, see above
