import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";

const { deployments, ethers } = require("hardhat");

describe("AdminFacet.setExpirationThreshold", () => {
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
        await adminFacet.connect(deployer).setExpirationThreshold(200)
      ).to.be.revertedWithCustomError(adminFacet, "CallerIsNotAdmin");
    });
  });

  beforeEach(async () => {
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
    const deployer = await ethers.getNamedSigner("deployer");
    await adminFacet.connect(deployer).setExpirationThreshold(200);

    const expirationThreshold = await viewStateFacet
      .connect(deployer)
      .getExpirationThreshold();
    expect(expirationThreshold).to.eq(200);
  });

  it("emits setExpirationThreshold", async () => {
    const { adminFacet } = await getContracts();
    const deployer = await ethers.getNamedSigner("deployer");
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
