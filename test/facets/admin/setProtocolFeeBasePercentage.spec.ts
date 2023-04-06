import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";

const { deployments, ethers } = require("hardhat");

describe("AdminFacet.setProtocolFeeBasePercentage", () => {
  beforeEach(async () => {
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("defaults protocolFeeBasePercentage to 1", async () => {
    const { viewStateFacet } = await getContracts();
    const signers = await ethers.getSigners();

    const protocolFeeBasePercentage = await viewStateFacet
      .connect(signers[0])
      .getProtocolFeeBasePercentage();
    expect(protocolFeeBasePercentage).to.eq(1);
  });

  it("sets the protocol fees base percentage if caller is owner", async () => {
    const { adminFacet, viewStateFacet } = await getContracts();
    const deployer = await ethers.getNamedSigner("deployer");
    await adminFacet.connect(deployer).setProtocolFeeBasePercentage(200);

    const protocolFeeBasePercentage = await viewStateFacet
      .connect(deployer)
      .getProtocolFeeBasePercentage();
    expect(protocolFeeBasePercentage).to.eq(200);
  });

  it("emits setProtocolFeeBasePercentage", async () => {
    const { adminFacet } = await getContracts();
    const deployer = await ethers.getNamedSigner("deployer");
    const tx = adminFacet.connect(deployer).setProtocolFeeBasePercentage(200);
    await expect(tx).to.emit(adminFacet, `SetProtocolFeeBasePercentage`);
  });

  it("reverts when a non-owner is the caller", async () => {
    const { adminFacet } = await getContracts();
    const signers = await ethers.getSigners();
    const tx = adminFacet.connect(signers[1]).setProtocolFeeBasePercentage(200);

    await expect(tx).to.be.reverted;
  });
});
