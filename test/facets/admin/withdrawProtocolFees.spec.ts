import { expect } from "chai";
import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { createSarcophagusWithRegisteredCursedArchaeologists } from "../helpers/sarcophagus";

const { deployments, ethers } = require("hardhat");

describe("AdminFacet.withdrawProtocolFees", () => {
  context("when caller is not the admin", async () => {
    beforeEach(async () => {
      process.env.ADMIN_ADDRESS = "0x1ABC7154748D1CE5144478CDEB574AE244B939B5";
      await deployments.fixture();
      accountGenerator.index = 0;
      delete process.env.ADMIN_ADDRESS;
    });

    it("reverts with the correct error message", async () => {
      const { adminFacet } = await getContracts();
      const deployer = await ethers.getNamedSigner("deployer");
      expect(
        await adminFacet.connect(deployer).withdrawProtocolFees()
      ).to.be.revertedWithCustomError(adminFacet, "CallerIsNotAdmin");
    });
  });

  // reset to directly after the diamond deployment before each test
  beforeEach(async () => {
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("should withdraw the proper amount of protocol fees", async () => {
    const { adminFacet, viewStateFacet, sarcoToken } = await getContracts();
    const deployer = await ethers.getNamedSigner("deployer");

    await createSarcophagusWithRegisteredCursedArchaeologists();

    const deployerBalanceBefore = await sarcoToken.balanceOf(deployer.address);
    await adminFacet.connect(deployer).withdrawProtocolFees();
    const deployerBalanceAfter = await sarcoToken.balanceOf(deployer.address);

    const protocolFees = await viewStateFacet.getTotalProtocolFees();

    expect(protocolFees).to.eq(0);
    expect(Number(deployerBalanceAfter)).to.be.greaterThan(
      Number(deployerBalanceBefore)
    );
  });

  it("should revert if the caller is not the contract owner", async () => {
    const { adminFacet } = await getContracts();
    const nonOwner = await accountGenerator.newAccount();

    await createSarcophagusWithRegisteredCursedArchaeologists();

    const tx = adminFacet.connect(nonOwner).withdrawProtocolFees();
    await expect(tx).to.be.revertedWith("LibDiamond: Must be contract owner");
  });
});
