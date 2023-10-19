import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";

const { deployments, ethers } = require("hardhat");
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("AdminFacet.transferDiamondOwner", () => {
  let deployer: SignerWithAddress;

  context("when caller is not the owner", async () => {
    beforeEach(async () => {
      await deployments.fixture();
      const { adminFacet } = await getContracts();
      deployer = await ethers.getNamedSigner("deployer");
      const signers = await ethers.getSigners();
      await adminFacet.connect(deployer).transferDiamondOwner(signers[1].address);
    });

    it("reverts", async () => {
      const { adminFacet } = await getContracts();
      const deployer = await ethers.getNamedSigner("deployer");
      const setTx = adminFacet
        .connect(deployer)
        .transferDiamondOwner(deployer.address);
      await expect(setTx).to.be.reverted;
    });
  });

  beforeEach(async () => {
    deployer = await ethers.getNamedSigner("deployer");
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("transfers the owner successfully", async () => {
    const { viewStateFacet, adminFacet } = await getContracts();
    const signers = await ethers.getSigners();
    await adminFacet.connect(deployer).transferDiamondOwner(signers[1].address);

    const ownerAddress = await adminFacet.connect(deployer).getDiamondOwner();
    expect(ownerAddress).to.eq(signers[1].address);
  });

  it("does allow owner address to be the zero address", async () => {
    const { adminFacet } = await getContracts();
    const deployer = await ethers.getNamedSigner("deployer");
    const setTx = adminFacet
      .connect(deployer)
      .transferDiamondOwner(ethers.constants.AddressZero);
    await expect(setTx).not.to.be.reverted;
  });
});
