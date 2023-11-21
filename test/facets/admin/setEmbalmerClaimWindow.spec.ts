import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { deployments, ethers } = require("hardhat");

describe("AdminFacet.setEmbalmerClaimWindow", () => {
  let deployer: SignerWithAddress;

  context("when caller is not the admin", async () => {
    beforeEach(async () => {
      await deployments.fixture();
    });

    it("reverts with the correct error message", async () => {
      const { adminFacet } = await getContracts();
      const signers = await ethers.getSigners();
      const setTx = adminFacet.connect(signers[1]).setEmbalmerClaimWindow(200);
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

  it("defaults embalmerClaimWindow to 604800", async () => {
    const { viewStateFacet } = await getContracts();
    const signers = await ethers.getSigners();

    const embalmerClaimWindow = await viewStateFacet
      .connect(signers[0])
      .getEmbalmerClaimWindow();
    expect(embalmerClaimWindow).to.eq(604800);
  });

  it("sets the grace period", async () => {
    const { adminFacet, viewStateFacet } = await getContracts();
    await adminFacet.connect(deployer).setEmbalmerClaimWindow(200);

    const embalmerClaimWindow = await viewStateFacet
      .connect(deployer)
      .getEmbalmerClaimWindow();
    expect(embalmerClaimWindow).to.eq(200);
  });

  it("emits setEmbalmerClaimWindow", async () => {
    const { adminFacet } = await getContracts();
    const tx = adminFacet.connect(deployer).setEmbalmerClaimWindow(200);
    // @ts-ignore
    await expect(tx).to.emit(adminFacet, `SetEmbalmerClaimWindow`);
  });
});
