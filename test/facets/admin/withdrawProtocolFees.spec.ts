import { expect } from "chai";
import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { createSarcophagusWithRegisteredCursedArchaeologists } from "../helpers/sarcophagus";

const { deployments, ethers } = require("hardhat");
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("AdminFacet.withdrawProtocolFees", () => {
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
        .withdrawProtocolFees(deployer.address);
      await expect(setTx).to.be.revertedWithCustomError(
        adminFacet,
        "CallerIsNotAdminOrOwner"
      );
    });
  });

  // reset to directly after the diamond deployment before each test
  beforeEach(async () => {
    deployer = await ethers.getNamedSigner("deployer");
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("should withdraw the proper amount of protocol fees", async () => {
    const { adminFacet, viewStateFacet, sarcoToken } = await getContracts();

    await createSarcophagusWithRegisteredCursedArchaeologists();

    const deployerBalanceBefore = await sarcoToken.balanceOf(deployer.address);
    await adminFacet.connect(deployer).withdrawProtocolFees(deployer.address);
    const deployerBalanceAfter = await sarcoToken.balanceOf(deployer.address);

    const protocolFees = await viewStateFacet.getTotalProtocolFees();

    expect(protocolFees).to.eq(0);
    expect(Number(deployerBalanceAfter)).to.be.greaterThan(
      Number(deployerBalanceBefore)
    );
  });
});
