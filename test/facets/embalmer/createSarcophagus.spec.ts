import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import time from "../../utils/time";
import { getContracts } from "../helpers/contracts";
import {
  buildCreateSarcophagusArgs,
  createSarcophagusData,
  registerDefaultArchaeologistsAndCreateSignatures,
} from "../helpers/sarcophagus";
import { fundAndApproveAccount } from "../helpers/sarcoToken";

const { deployments, ethers } = require("hardhat");

describe("EmbalmerFacet.createSarcophagus", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("Validates parameters", function () {
    it("breadsShould revert if supplied expired sarcophagus parameters", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({
        threshold: 3,
        totalShares: 5,
        maximumRewrapIntervalSeconds: time.duration.weeks(4),
      });
      // set an expired creationTime
      sarcophagusData.creationTime =
        (await time.latest()) - time.duration.weeks(12);

      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);

      // transfer 100k sarco to the embalmer and approve the diamond to spend on their behalf
      await fundAndApproveAccount(sarcophagusData.embalmer, 100_000);

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusParametersExpired`
      );
    });
    it("Should revert if supplied resurrection time that has passed");
    it(
      "Should revert if supplied resurrection time is after maximumRewrapInterval"
    );
    it("Should revert if no archaeologists are supplied");
    it(
      "Should revert if supplied threshold is greater than total number of archaeologists"
    );
    it(
      "Should revert if one of the supplied archaeologists doesn't have a registered profile"
    );
    it("Should revert if the archaeologist list contains duplicates");
  });
  describe("Validates archaeologist signatures", function () {
    it(
      "Should revert if an archaeologist has not signed off on one of the required parameters"
    );
  });

  describe("Successfully creates a sarcophagus", function () {
    it(
      "Should lock bond equal to the supplied archaeologist's diggingFee property for the sarcophagus"
    );
    it(
      "Should charge the embalmer the total of all locked bonds plus the protocol fees"
    );
    it(
      "Should store all selected archaeologists on the newly created sarcophagus"
    );
    it(
      "Should store all supplied sarcophagus parameters on the newly created sarcophagus"
    );
    it(
      "Should update convenience lookup data structures with the new sarcophagus"
    );
  });
});
