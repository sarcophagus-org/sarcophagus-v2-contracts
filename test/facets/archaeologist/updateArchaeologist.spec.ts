import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { diggingFeesPerSecond_10_000_SarcoMonthly } from "../helpers/sarcophagus";
import { fundAndApproveAccount } from "../helpers/sarcoToken";

const { deployments, ethers } = require("hardhat");

describe("ArchaeologistFacet.updateArchaeologist", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => {
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("should update an archaeologist profile", async () => {
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

    const newPeerId = `new peerId for ${archaeologistSigner.address}`;
    const newMaximumRewrapInterval = 60 * 24 * 60 * 60; // 60 days
    const addedFreeBond = 10000;
    const newMaxResurrectionTime = Math.floor(
      Date.now() / 1000 + 600 * 24 * 60 * 60
    );
    const newCurseFee = 20;
    const newDiggingFeesPerSecond = 5n * 10n ** 15n;

    const tx = await archaeologistFacet
      .connect(archaeologistSigner)
      .updateArchaeologist(
        newPeerId,
        newDiggingFeesPerSecond,
        newMaximumRewrapInterval,
        addedFreeBond,
        newMaxResurrectionTime,
        newCurseFee
      );

    const archaeologist = await viewStateFacet.getArchaeologistProfile(
      archaeologistSigner.address
    );

    expect(archaeologist.peerId).to.equal(newPeerId);
    expect(archaeologist.maximumRewrapInterval).to.equal(
      newMaximumRewrapInterval
    );
    expect(archaeologist.minimumDiggingFeePerSecond).to.equal(
      newDiggingFeesPerSecond
    );
    expect(archaeologist.maximumResurrectionTime).to.equal(
      newMaxResurrectionTime
    );
    expect(archaeologist.freeBond).to.equal(freeBond + addedFreeBond);
    expect(archaeologist.curseFee).to.equal(newCurseFee);

    expect(tx).to.emit(archaeologistFacet, `UpdateArchaeologist`);
  });

  it("should revert if archaeologist does not exist", async () => {
    const { archaeologistFacet, viewStateFacet } = await getContracts();

    const archaeologistSigner = await accountGenerator.newAccount();

    // transfer sarco to archaeologist signer and approve the diamond to spend on their behalf
    await fundAndApproveAccount(archaeologistSigner, 40_000);

    const newPeerId = `new peerId for ${archaeologistSigner.address}`;
    const newMaximumRewrapInterval = 60 * 24 * 60 * 60; // 60 days
    const addedFreeBond = 10000;
    const newMaxResurrectionTime = Math.floor(
      Date.now() / 1000 + 600 * 24 * 60 * 60
    );
    const newCurseFee = 20;
    const newDiggingFeesPerSecond = 5n * 10n ** 15n;

    const tx = archaeologistFacet
      .connect(archaeologistSigner)
      .updateArchaeologist(
        newPeerId,
        newDiggingFeesPerSecond,
        newMaximumRewrapInterval,
        addedFreeBond,
        newMaxResurrectionTime,
        newCurseFee
      );

    await expect(tx).to.be.revertedWithCustomError(
      archaeologistFacet,
      "ArchaeologistProfileExistsShouldBe"
    );
  });

  it("should revert if max rewrap interval is set to 0", async () => {
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

    const newPeerId = `new peerId for ${archaeologistSigner.address}`;
    const newMaximumRewrapInterval = 0;
    const addedFreeBond = 10000;
    const newMaxResurrectionTime = Math.floor(
      Date.now() / 1000 + 600 * 24 * 60 * 60
    );
    const newCurseFee = 20;
    const newDiggingFeesPerSecond = 5n * 10n ** 15n;

    const tx = archaeologistFacet
      .connect(archaeologistSigner)
      .updateArchaeologist(
        newPeerId,
        newDiggingFeesPerSecond,
        newMaximumRewrapInterval,
        addedFreeBond,
        newMaxResurrectionTime,
        newCurseFee
      );

    await expect(tx).to.be.revertedWithCustomError(
      archaeologistFacet,
      "CannotSetZeroProfileValue"
    );
  });

  it("should revert if minimum digging fee per second is set to 0", async () => {
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

    const newPeerId = `new peerId for ${archaeologistSigner.address}`;
    const newMaximumRewrapInterval = 60 * 24 * 60 * 60; // 60 days
    const addedFreeBond = 10000;
    const newMaxResurrectionTime = Math.floor(
      Date.now() / 1000 + 600 * 24 * 60 * 60
    );
    const newCurseFee = 20;
    const newDiggingFeesPerSecond = 0;

    const tx = archaeologistFacet
      .connect(archaeologistSigner)
      .updateArchaeologist(
        newPeerId,
        newDiggingFeesPerSecond,
        newMaximumRewrapInterval,
        addedFreeBond,
        newMaxResurrectionTime,
        newCurseFee
      );

    await expect(tx).to.be.revertedWithCustomError(
      archaeologistFacet,
      "CannotSetZeroProfileValue"
    );
  });
});
