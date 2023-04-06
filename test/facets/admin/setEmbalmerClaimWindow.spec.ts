import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";

const { deployments, ethers } = require("hardhat");

describe("AdminFacet.setEmbalmerClaimWindow", () => {
  beforeEach(async () => {
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

  it("sets the grace period if caller is owner", async () => {
    const { adminFacet, viewStateFacet } = await getContracts();
    const deployer = await ethers.getNamedSigner("deployer");
    await adminFacet.connect(deployer).setEmbalmerClaimWindow(200);

    const embalmerClaimWindow = await viewStateFacet
      .connect(deployer)
      .getEmbalmerClaimWindow();
    expect(embalmerClaimWindow).to.eq(200);
  });

  it("emits setEmbalmerClaimWindow", async () => {
    const { adminFacet } = await getContracts();
    const deployer = await ethers.getNamedSigner("deployer");
    const tx = adminFacet.connect(deployer).setEmbalmerClaimWindow(200);
    // @ts-ignore
    await expect(tx).to.emit(adminFacet, `SetEmbalmerClaimWindow`);
  });

  it("reverts when a non-owner is the caller", async () => {
    const { adminFacet } = await getContracts();
    const signers = await ethers.getSigners();
    const tx = adminFacet.connect(signers[1]).setEmbalmerClaimWindow(200);

    // @ts-ignore
    await expect(tx).to.be.reverted;
  });
});
