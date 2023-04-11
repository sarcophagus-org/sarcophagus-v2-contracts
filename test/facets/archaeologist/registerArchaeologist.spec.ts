import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { diggingFeesPerSecond_10_000_SarcoMonthly } from "../helpers/sarcophagus";
import { fundAndApproveAccount } from "../helpers/sarcoToken";

const { deployments, ethers } = require("hardhat");

describe("ArchaeologistFacet.registerArchaeologist", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => {
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("should create an archaeologist profile", async () => {
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

    const tx = await archaeologistFacet
      .connect(archaeologistSigner)
      .registerArchaeologist(
        peerId,
        diggingFeesPerSecond_10_000_SarcoMonthly,
        maximumRewrapInterval,
        freeBond,
        maxResurrectionTime,
        curseFee
      );

    const archaeologist = await viewStateFacet.getArchaeologistProfile(
      archaeologistSigner.address
    );

    expect(archaeologist.peerId).to.equal(peerId);
    expect(archaeologist.maximumRewrapInterval).to.equal(maximumRewrapInterval);
    expect(archaeologist.maximumResurrectionTime).to.equal(maxResurrectionTime);
    expect(archaeologist.minimumDiggingFeePerSecond).to.equal(
      diggingFeesPerSecond_10_000_SarcoMonthly
    );
    expect(archaeologist.freeBond).to.equal(freeBond);
    expect(archaeologist.cursedBond).to.equal(0);
    expect(archaeologist.curseFee).to.equal(curseFee);

    await expect(tx).to.emit(archaeologistFacet, `RegisterArchaeologist`);
  });

  it("should revert if archaeologist already exists", async () => {
    const { archaeologistFacet } = await getContracts();

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

    const tx = archaeologistFacet
      .connect(archaeologistSigner)
      .registerArchaeologist(
        peerId,
        diggingFeesPerSecond_10_000_SarcoMonthly,
        maximumRewrapInterval,
        freeBond,
        maxResurrectionTime,
        curseFee
      );
    await expect(tx).to.be.revertedWithCustomError(
      archaeologistFacet,
      "ArchaeologistProfileExistsShouldBe"
    );
  });

  it("should revert if max rewrap interval is set to 0", async () => {
    const { archaeologistFacet } = await getContracts();

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

    const tx = archaeologistFacet
      .connect(archaeologistSigner)
      .registerArchaeologist(
        peerId,
        diggingFeesPerSecond_10_000_SarcoMonthly,
        0,
        freeBond,
        maxResurrectionTime,
        curseFee
      );
    await expect(tx).to.be.revertedWithCustomError(
      archaeologistFacet,
      "CannotSetZeroProfileValue"
    );
  });

  it("should revert if minimum digging fee per second is set to 0", async () => {
    const { archaeologistFacet } = await getContracts();

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

    const tx = archaeologistFacet
      .connect(archaeologistSigner)
      .registerArchaeologist(
        peerId,
        0,
        maximumRewrapInterval,
        freeBond,
        maxResurrectionTime,
        curseFee
      );
    await expect(tx).to.be.revertedWithCustomError(
      archaeologistFacet,
      "CannotSetZeroProfileValue"
    );
  });
});
