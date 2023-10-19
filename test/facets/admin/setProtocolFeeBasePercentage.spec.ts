import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";

const { deployments, ethers } = require("hardhat");
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("AdminFacet.setProtocolFeeBasePercentage", () => {
  let deployer: SignerWithAddress;

  context("when caller is not the admin", async () => {
    beforeEach(async () => {
      await deployments.fixture();
    });

    it("reverts with the correct error message", async () => {
      const { adminFacet } = await getContracts();
      const signers = await ethers.getSigners();
      const setTx = adminFacet
        .connect(signers[1])
        .setProtocolFeeBasePercentage(200);
      await expect(setTx).to.be.revertedWithCustomError(
        adminFacet,
        "CallerIsNotAdminOrOwner"
      );
    });
  });

  beforeEach(async () => {
    deployer = await ethers.getNamedSigner("deployer");
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("defaults protocolFeeBasePercentage to 100 (1%)", async () => {
    const { viewStateFacet } = await getContracts();
    const signers = await ethers.getSigners();

    const protocolFeeBasePercentage = await viewStateFacet
      .connect(signers[0])
      .getProtocolFeeBasePercentage();
    expect(protocolFeeBasePercentage).to.eq(100);
  });

  it("sets the protocol fees base percentage", async () => {
    const { adminFacet, viewStateFacet } = await getContracts();
    await adminFacet.connect(deployer).setProtocolFeeBasePercentage(200);

    const protocolFeeBasePercentage = await viewStateFacet
      .connect(deployer)
      .getProtocolFeeBasePercentage();
    expect(protocolFeeBasePercentage).to.eq(200);
  });

  it("emits setProtocolFeeBasePercentage", async () => {
    const { adminFacet } = await getContracts();
    const tx = adminFacet.connect(deployer).setProtocolFeeBasePercentage(200);
    await expect(tx).to.emit(adminFacet, `SetProtocolFeeBasePercentage`);
  });
});
