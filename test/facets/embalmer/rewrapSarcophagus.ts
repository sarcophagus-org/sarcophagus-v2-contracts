import "@nomicfoundation/hardhat-chai-matchers";
import { getContracts } from "../helpers/contracts";
import { registerSarcophagusWithArchaeologists } from "../helpers/sarcophagus";
import { expect } from "chai";
import { compromiseSarcophagus } from "../helpers/accuse";
import { getFreshAccount } from "../helpers/accounts";
import time from "../../utils/time";

const { deployments, ethers } = require("hardhat");

describe("EmbalmerFacet.rewrapSarcophagus", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("Validates parameters. Should revert if:", function () {
    it("no sarcophagus with the supplied id exists", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(
          ethers.utils.solidityKeccak256(["string"], ["nonexistent"]),
          sarcophagusData.resurrectionTimeSeconds
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusDoesNotExist`
      );
    });
    it("the sarcophagus has been compromised", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      await compromiseSarcophagus(sarcophagusData, archaeologists);

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(
          sarcophagusData.sarcoId,
          sarcophagusData.resurrectionTimeSeconds
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusCompromised`
      );
    });
    it("the sarcophagus has been buried", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(
          sarcophagusData.sarcoId,
          sarcophagusData.resurrectionTimeSeconds
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusInactive`
      );
    });
    it("the sender is not the embalmer", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      const tx = embalmerFacet
        .connect(await getFreshAccount())
        .rewrapSarcophagus(
          sarcophagusData.sarcoId,
          sarcophagusData.resurrectionTimeSeconds
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SenderNotEmbalmer`
      );
    });
    it("the resurrection time has passed", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(
          sarcophagusData.sarcoId,
          sarcophagusData.resurrectionTimeSeconds
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `ResurrectionTimeInPast`
      );
    });
    it("the new resurrection time is not in the future", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(sarcophagusData.sarcoId, await time.latest());

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `NewResurrectionTimeInPast`
      );
    });
    it("the new resurrection time exceeds sarcophagus maximumRewrapInterval", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(
          sarcophagusData.sarcoId,
          (await time.latest()) +
            sarcophagusData.maximumRewrapIntervalSeconds +
            time.duration.minutes(1)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `NewResurrectionTimeTooLarge`
      );
    });
  });

  describe("Successfully rewraps a sarcophagus with no accusals", function () {
    it("Should pay digging fees to each of the cursed archaeologists");
    it(
      "Should charge the embalmer the total digging fees for all archaeologists plus the protocol fees"
    );

    it("Should update the resurrectionTime and emit RewrapSarcophagus");
  });
  describe("Successfully rewraps a sarcophagus with fewer than k accusals", function () {
    it("Should not pay digging fees to accused archaeologists");

    it("Should exclude accused archaeologist digging fees from embalmer costs");
  });
});
