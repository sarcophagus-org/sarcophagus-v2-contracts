import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";

const { deployments, ethers } = require("hardhat");
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("AdminFacet.setExpirationThreshold", () => {
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
      const setTx = adminFacet.connect(deployer).setExpirationThreshold(200);
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

  it("defaults expirationThreshold to 3600", async () => {
    const { viewStateFacet } = await getContracts();
    const signers = await ethers.getSigners();

    const expirationThreshold = await viewStateFacet
      .connect(signers[0])
      .getExpirationThreshold();
    expect(expirationThreshold).to.eq(3600);
  });

  it("sets the expiration threshold if caller is owner", async () => {
    const { adminFacet, viewStateFacet } = await getContracts();
    await adminFacet.connect(deployer).setExpirationThreshold(200);

    const expirationThreshold = await viewStateFacet
      .connect(deployer)
      .getExpirationThreshold();
    expect(expirationThreshold).to.eq(200);
  });

  it("emits setExpirationThreshold", async () => {
    const { adminFacet } = await getContracts();
    const tx = adminFacet.connect(deployer).setExpirationThreshold(200);
    // @ts-ignore
    await expect(tx).to.emit(adminFacet, `SetExpirationThreshold`);
  });

  it("reverts when a non-owner is the caller", async () => {
    const { adminFacet } = await getContracts();
    const signers = await ethers.getSigners();
    const tx = adminFacet.connect(signers[1]).setExpirationThreshold(200);

    // @ts-ignore
    await expect(tx).to.be.reverted;
  });
});
