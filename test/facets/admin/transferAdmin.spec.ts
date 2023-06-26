import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";

const { deployments, ethers } = require("hardhat");
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("AdminFacet.transferAdmin", () => {
  let deployer: SignerWithAddress;

  context("when caller is not the admin", async () => {
    beforeEach(async () => {
      await deployments.fixture();
      const { adminFacet } = await getContracts();
      deployer = await ethers.getNamedSigner("deployer");
      const signers = await ethers.getSigners();
      await adminFacet.connect(deployer).transferAdmin(signers[1].address);
    });

    it("reverts with the correct error message", async () => {
      const { adminFacet } = await getContracts();
      const deployer = await ethers.getNamedSigner("deployer");
      const setTx = adminFacet
        .connect(deployer)
        .transferAdmin(deployer.address);
      await expect(setTx).to.be.revertedWithCustomError(
        adminFacet,
        "CallerIsNotAdmin"
      );
    });
  });

  beforeEach(async () => {
    deployer = await ethers.getNamedSigner("deployer");
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("transfers the admin successfully", async () => {
    const { viewStateFacet, adminFacet } = await getContracts();
    const signers = await ethers.getSigners();
    await adminFacet.connect(deployer).transferAdmin(signers[1].address);

    const adminAddress = await viewStateFacet.connect(deployer).getAdmin();
    expect(adminAddress).to.eq(signers[1].address);
  });

  it("emits transferAdmin event", async () => {
    const { viewStateFacet, adminFacet } = await getContracts();
    const signers = await ethers.getSigners();
    const transferTx = adminFacet
      .connect(deployer)
      .transferAdmin(signers[1].address);

    await expect(transferTx).to.emit(adminFacet, `AdminTransferred`);
  });

  it("does not allow admin address to be the zero address", async () => {
    const { adminFacet } = await getContracts();
    const deployer = await ethers.getNamedSigner("deployer");
    const setTx = adminFacet
      .connect(deployer)
      .transferAdmin(ethers.constants.AddressZero);
    await expect(setTx).to.be.revertedWithCustomError(
      adminFacet,
      "ZeroAddress"
    );
  });
});
