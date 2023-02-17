import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";

const { deployments, ethers } = require("hardhat");

describe("AdminFacet.setCursedBondPercentage", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => {
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("defaults the cursedBondPercentage to 100", async () => {
    const { viewStateFacet } = await getContracts();
    const signers = await ethers.getSigners();

    const cursedBondPercentage = await viewStateFacet
      .connect(signers[0])
      .getCursedBondPercentage();
    expect(cursedBondPercentage).to.eq(100);
  });

  it("sets the cursed bond percentage if caller is owner", async () => {
    const { adminFacet, viewStateFacet } = await getContracts();
    const deployer = await ethers.getNamedSigner("deployer");
    await adminFacet
      .connect(deployer)
      .setCursedBondPercentage(200);

    const cursedBondPercentage = await viewStateFacet
      .connect(deployer)
      .getCursedBondPercentage();
    expect(cursedBondPercentage).to.eq(200);
  });

  it("reverts when a non-owner is the caller", async () => {
    const { adminFacet, viewStateFacet } = await getContracts();
    const signers = await ethers.getSigners();
    const tx = adminFacet
      .connect(signers[1])
      .setCursedBondPercentage(200);

    await expect(tx).to.be.reverted;
  });
});
