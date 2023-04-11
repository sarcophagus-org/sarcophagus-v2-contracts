import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { diggingFeesPerSecond_10_000_SarcoMonthly } from "../helpers/sarcophagus";
import { fundAndApproveAccount } from "../helpers/sarcoToken";

const { deployments, ethers } = require("hardhat");

describe("ArchaeologistFacet.withdrawFreeBond", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => {
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("should withdraw free bond", async () => {
    const { archaeologistFacet, viewStateFacet } = await getContracts();

    const archaeologistSigner = await accountGenerator.newAccount();

    // transfer sarco to archaeologist signer and approve the diamond to spend on their behalf
    await fundAndApproveAccount(archaeologistSigner, 40_000);

    const peerId = `peerId for ${archaeologistSigner.address}`;
    const maximumRewrapInterval = 30 * 24 * 60 * 60; // 30 days
    const freeBond = 5000;
    const maxResurrectionTime = Math.floor(
      Date.now() / 1000 + 365 * 24 * 60 * 60
    );
    const curseFee = 10;

    await archaeologistFacet
      .connect(archaeologistSigner)
      .registerArchaeologist(
        peerId,
        diggingFeesPerSecond_10_000_SarcoMonthly,
        maximumRewrapInterval,
        freeBond,
        maxResurrectionTime,
        curseFee
      );

    const freeBondToAdd = 1000;

    const tx = await archaeologistFacet
      .connect(archaeologistSigner)
      .withdrawFreeBond(freeBondToAdd);

    const archaeologist = await viewStateFacet.getArchaeologistProfile(
      archaeologistSigner.address
    );

    expect(archaeologist.freeBond).to.equal(freeBond - freeBondToAdd);

    await expect(tx).to.emit(archaeologistFacet, `WithdrawFreeBond`);
  });

  it("should revert if the archaeologist does not exist", async () => {
    const { archaeologistFacet, viewStateFacet } = await getContracts();

    const archaeologistSigner = await accountGenerator.newAccount();

    // transfer sarco to archaeologist signer and approve the diamond to spend on their behalf
    await fundAndApproveAccount(archaeologistSigner, 40_000);

    const freeBondToAdd = 1000;

    const tx = archaeologistFacet
      .connect(archaeologistSigner)
      .withdrawFreeBond(freeBondToAdd);

    await expect(tx).to.be.revertedWithCustomError(
      archaeologistFacet,
      "ArchaeologistProfileExistsShouldBe"
    );
  });
});
