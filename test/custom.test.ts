import { sdk, signers } from "./before.test";
import { expect } from "chai";
import invariant from "tiny-invariant";
import {
  TokenERC20__factory,
  TokenERC721__factory,
  VoteERC20__factory,
} from "@thirdweb-dev/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { uploadContractMetadata } from "./publisher.test";
import { ethers } from "ethers";

global.fetch = require("node-fetch");

describe("Custom Contracts", async () => {
  let customContractAddress: string;
  let nftContractAddress: string;
  let tokenContractAddress: string;
  let adminWallet: SignerWithAddress,
    samWallet: SignerWithAddress,
    bobWallet: SignerWithAddress;

  before(async () => {
    [adminWallet, samWallet, bobWallet] = signers;
    const simpleContractUri = await uploadContractMetadata(
      "test/abis/greeter.json",
    );
    const tx = await sdk.publisher.publish(simpleContractUri);
    const contract = await tx.data();
    customContractAddress = await sdk.publisher.deployCustomContract(
      adminWallet.address,
      contract.id,
      [],
      {
        name: "CustomContract",
      },
    );
  });

  beforeEach(async () => {
    sdk.updateSignerOrProvider(adminWallet);
    nftContractAddress = await sdk.deployer.deployNFTCollection({
      name: `Drop`,
      description: "Test contract from tests",
      image:
        "https://pbs.twimg.com/profile_images/1433508973215367176/XBCfBn3g_400x400.jpg",
      primary_sale_recipient: samWallet.address,
      seller_fee_basis_points: 500,
      fee_recipient: bobWallet.address,
      platform_fee_basis_points: 10,
      platform_fee_recipient: adminWallet.address,
    });
    tokenContractAddress = await sdk.deployer.deployToken({
      name: `Token`,
      description: "Test contract from tests",
      image:
        "https://pbs.twimg.com/profile_images/1433508973215367176/XBCfBn3g_400x400.jpg",
      primary_sale_recipient: samWallet.address,
      platform_fee_basis_points: 10,
      platform_fee_recipient: adminWallet.address,
    });
    await sdk.getToken(tokenContractAddress).mint(100);
    await sdk.getNFTCollection(nftContractAddress).mint({
      name: "Custom NFT",
    });
  });

  it("should call raw ABI functions", async () => {
    const c = await sdk.getCustomContract(customContractAddress);
    invariant(c, "Contract undefined");
    expect(await c.read.decimals()).to.eq(18);
    await c.write.mint(ethers.utils.parseUnits("10"));
    expect((await c.read.totalSupply()).toString()).to.eq(
      ethers.utils.parseUnits("10").toString(),
    );
  });

  it("should fetch published metadata", async () => {
    const c = await sdk.getCustomContract(customContractAddress);
    invariant(c, "Contract undefined");
    const meta = await c.publishedMetadata.get();
    expect(meta.name).to.eq("Greeter");
  });

  it("should extract functions", async () => {
    const c = await sdk.getCustomContract(customContractAddress);
    invariant(c, "Contract undefined");
    const functions = await c.publishedMetadata.extractFunctions();
    expect(functions.length).gt(0);
  });

  it("should detect feature: metadata", async () => {
    const c = await sdk.getCustomContract(customContractAddress);
    invariant(c, "Contract undefined");
    const meta = await c.metadata.get();
    expect(meta.name).to.eq("CustomContract");
  });

  it("should detect feature: roles", async () => {
    const c = await sdk.getCustomContract(
      nftContractAddress,
      TokenERC721__factory.abi,
    );
    invariant(c, "Contract undefined");
    invariant(c.roles, "Roles undefined");
    const admins = await c.roles.get("admin");
    expect(admins[0]).to.eq(adminWallet.address);
    const minters = await c.roles.get("minter");
    expect(minters[0]).to.eq(adminWallet.address);
    expect(minters.length).to.eq(1);
    await c.roles.grant("minter", samWallet.address);
    const minters2 = await c.roles.get("minter");
    expect(minters2.length).to.eq(2);
    expect(minters2[0]).to.eq(adminWallet.address);
    expect(minters2[1]).to.eq(samWallet.address);
  });

  it("should detect feature: royalties", async () => {
    const c = await sdk.getCustomContract(
      nftContractAddress,
      TokenERC721__factory.abi,
    );
    invariant(c, "Contract undefined");
    invariant(c.royalties, "Royalties undefined");
    const royalties = await c.royalties.getDefaultRoyaltyInfo();
    expect(royalties.fee_recipient).to.eq(bobWallet.address);
    expect(royalties.seller_fee_basis_points).to.eq(500);
    await c.royalties.setDefaultRoyaltyInfo({
      fee_recipient: samWallet.address,
      seller_fee_basis_points: 1000,
    });
    const royalties2 = await c.royalties.getDefaultRoyaltyInfo();
    expect(royalties2.fee_recipient).to.eq(samWallet.address);
    expect(royalties2.seller_fee_basis_points).to.eq(1000);
  });

  it("should detect feature: primary sales", async () => {
    const c = await sdk.getCustomContract(
      nftContractAddress,
      TokenERC721__factory.abi,
    );
    invariant(c, "Contract undefined");
    invariant(c.sales, "Primary sales undefined");
    const recipient = await c.sales.getRecipient();
    expect(recipient).to.eq(samWallet.address);
    await c.sales.setRecipient(bobWallet.address);
    const recipient2 = await c.sales.getRecipient();
    expect(recipient2).to.eq(bobWallet.address);
  });

  it("should detect feature: primary sales", async () => {
    const c = await sdk.getCustomContract(
      nftContractAddress,
      TokenERC721__factory.abi,
    );
    invariant(c, "Contract undefined");
    invariant(c.platformFees, "Platform fees undefined");
    const fees = await c.platformFees.get();
    expect(fees.platform_fee_recipient).to.eq(adminWallet.address);
    expect(fees.platform_fee_basis_points).to.eq(10);
    await c.platformFees.set({
      platform_fee_recipient: samWallet.address,
      platform_fee_basis_points: 500,
    });
    const fees2 = await c.platformFees.get();
    expect(fees2.platform_fee_recipient).to.eq(samWallet.address);
    expect(fees2.platform_fee_basis_points).to.eq(500);
  });

  it("should not detect feature if missing from ABI", async () => {
    const c = await sdk.getCustomContract("", VoteERC20__factory.abi);
    invariant(c, "Contract undefined");
    invariant(c.metadata, "Metadata undefined");
    expect(c.roles).to.eq(undefined);
  });

  it("should detect feature: erc20", async () => {
    const c = await sdk.getCustomContract(
      tokenContractAddress,
      TokenERC20__factory.abi,
    );
    invariant(c, "Contract undefined");
    invariant(c.token, "ERC20 undefined");
    const token = await c.token.get();
    expect(token.name).to.eq("Token");
    expect(token.decimals).to.eq(18);
    const balance = await c.token.balance();
    expect(balance.displayValue).to.eq("100.0");
    await c.token.transfer(samWallet.address, 25);
    expect((await c.token.balance()).displayValue).to.eq("75.0");
    expect((await c.token.balanceOf(samWallet.address)).displayValue).to.eq(
      "25.0",
    );
  });

  it("should detect feature: erc721", async () => {
    const c = await sdk.getCustomContract(
      nftContractAddress,
      TokenERC721__factory.abi,
    );
    invariant(c, "Contract undefined");
    invariant(c.nft, "ERC721 undefined");
    invariant(c.nft.query, "ERC721 query undefined");
    const nfts = await c.nft.query.getAll();
    console.log((await c.nft.query.getTotalCount()).toNumber());
    expect(nfts.length).to.eq(1);
    expect(nfts[0].metadata.name).to.eq("Custom NFT");
    invariant(c.nft.minter, "ERC721 minter undefined");
    await c.nft.minter.mint({
      name: "Some NFT",
    });
    const nfts2 = await c.nft.query.getAll();
    expect(nfts2.length).to.eq(2);
  });
});
