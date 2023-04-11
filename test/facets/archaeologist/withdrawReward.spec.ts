import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import {
  createSarcophagusWithRegisteredCursedArchaeologists,
  diggingFeesPerSecond_10_000_SarcoMonthly,
} from "../helpers/sarcophagus";
import { fundAndApproveAccount } from "../helpers/sarcoToken";

const { deployments, ethers } = require("hardhat");

describe.only("ArchaeologistFacet.withdrawReward", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => {
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("should withdraw reward", async () => {
    const { archaeologistFacet, embalmerFacet, viewStateFacet, sarcoToken } =
      await getContracts();

    const archaeologistSigner = await accountGenerator.newAccount();

    const {
      createdSarcophagusData: sarcophagusData,
      cursedArchaeologists: archaeologists,
    } = await createSarcophagusWithRegisteredCursedArchaeologists();

    const { embalmer, sarcoId, resurrectionTimeSeconds } = sarcophagusData;

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

    await embalmerFacet
      .connect(embalmer)
      .rewrapSarcophagus(sarcoId, resurrectionTimeSeconds + 10);

    await archaeologistFacet.connect(archaeologistSigner).withdrawReward();

    const rewards = await viewStateFacet.getRewards(
      archaeologistSigner.address
    );

    expect(rewards).to.equal(0);

    const sarcoBalance = await sarcoToken.balanceOf(
      archaeologistSigner.address
    );

    expect(sarcoBalance).to.be.greaterThan(0);
  });
});
