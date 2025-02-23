import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { assert } from "chai";
import { sdk, signers } from "./before-setup";
import { Split, Token } from "../src";

global.fetch = require("cross-fetch");

describe("Splits Contract", async () => {
  let splitsContract: Split;
  let adminWallet: SignerWithAddress,
    samWallet: SignerWithAddress,
    bobWallet: SignerWithAddress,
    abbyWallet: SignerWithAddress;

  before(() => {
    [adminWallet, samWallet, bobWallet, abbyWallet] = signers;
  });

  beforeEach(async () => {
    sdk.updateSignerOrProvider(adminWallet);
    const address = await sdk.deployer.deployBuiltInContract(
      Split.contractType,
      {
        name: "Splits Contract",
        recipients: [
          {
            address: samWallet.address,
            sharesBps: 3333,
          },
          {
            address: bobWallet.address,
            sharesBps: 3333,
          },
          {
            address: abbyWallet.address,
            sharesBps: 3334,
          },
        ],
      },
    );
    splitsContract = sdk.getSplit(address);
  });

  // TODO: Fix bug in the `getAllRecipients` function
  it("should return all recipients of splits", async () => {
    const recipients = await splitsContract.getAllRecipients();
    assert.lengthOf(
      recipients,
      3,
      "There should be 3 split recipients on this contract",
    );
  });

  it("should return the correct slip percentage for an address", async () => {
    assert.equal(
      (await splitsContract.getRecipientSplitPercentage(samWallet.address))
        .splitPercentage,
      33.33,
      "Each wallet should have 1/3rd of the split",
    );
  });

  it("should return all the recipients along with their balances", async () => {
    const balances = await splitsContract.balanceOfAllRecipients();
    assert.equal(
      Object.keys(balances).length,
      3,
      "There should be 3 recipients",
    );
  });

  it("should return all the recipients along with their token balances", async () => {
    const addr = await sdk.deployer.deployBuiltInContract(Token.contractType, {
      name: "Test Token",
      symbol: "TST",
      primary_sale_recipient: adminWallet.address,
    });
    const balances = await splitsContract.balanceOfTokenAllRecipients(addr);
    assert.equal(
      Object.keys(balances).length,
      3,
      "There should be 3 recipients",
    );
  });

  /**
   * TODO: Write the following tests
   *
   * 1. Withdrawing royalties and assuring fund delivery
   * 2. Checking balances
   * 3. Funds are received when a contract uses a splits address as a royalty recipient
   */
});
