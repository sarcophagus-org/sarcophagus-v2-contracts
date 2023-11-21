import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";

const { deployments, ethers } = require("hardhat");
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("AdminFacet.setGracePeriod", () => {
  let deployer: SignerWithAddress;

  context("when caller is not the admin", async () => {
    beforeEach(async () => {
      await deployments.fixture();
    });

    it("reverts with the correct error message", async () => {
      const { adminFacet } = await getContracts();
      const signers = await ethers.getSigners();
      const setTx = adminFacet.connect(signers[1]).setGracePeriod(200);
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

  it("defaults gracePeriod to 1 day (86400 seconds)", async () => {
    const { viewStateFacet } = await getContracts();
    const signers = await ethers.getSigners();

    const gracePeriod = await viewStateFacet
      .connect(signers[0])
      .getGracePeriod();
    expect(gracePeriod).to.eq(86400);
  });

  it("sets the grace period", async () => {
    const { adminFacet, viewStateFacet } = await getContracts();
    await adminFacet.connect(deployer).setGracePeriod(200);

    const gracePeriod = await viewStateFacet.connect(deployer).getGracePeriod();
    expect(gracePeriod).to.eq(200);
  });

  it("emits SetGracePeriod", async () => {
    const { adminFacet } = await getContracts();
    const tx = adminFacet.connect(deployer).setGracePeriod(200);
    // @ts-ignore
    await expect(tx).to.emit(adminFacet, `SetGracePeriod`);
  });
});
