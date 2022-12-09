import "@nomicfoundation/hardhat-chai-matchers";
import { getContracts } from "../helpers/contracts";
import { registerSarcophagusWithArchaeologists } from "../helpers/sarcophagus";
import { expect } from "chai";
import { compromiseSarcophagus } from "../helpers/accuse";
import time from "../../utils/time";
import { hashShare } from "../helpers/shamirSecretSharing";
import {
  getArchaeologistFreeBondSarquitos,
  getArchaeologistLockedBondSarquitos,
} from "../helpers/bond";

const { deployments, ethers } = require("hardhat");

describe("ArchaeologistFacet.publishKeyShare", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("Validates parameters. Should revert if:", function () {
    it("no sarcophagus with the supplied id exists", async function () {
      const { archaeologistFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          ethers.utils.solidityKeccak256(["string"], ["nonexistent"]),
          archaeologists[0].rawKeyShare
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `SarcophagusDoesNotExist`
      );
    });
    it("the sarcophagus has been compromised", async function () {
      const { archaeologistFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      await compromiseSarcophagus(sarcophagusData, archaeologists);

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `SarcophagusCompromised`
      );
    });
    it("the sarcophagus has been buried", async function () {
      const { archaeologistFacet, embalmerFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `SarcophagusInactive`
      );
    });
    it("the resurrection time has not passed", async function () {
      const { archaeologistFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `TooEarlyToUnwrap`
      );
    });

    it("the grace period has passed", async function () {
      const { archaeologistFacet, viewStateFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();
      const gracePeriod = await viewStateFacet.getGracePeriod();

      await time.increaseTo(
        sarcophagusData.resurrectionTimeSeconds + gracePeriod.toNumber()
      );

      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `TooLateToUnwrap`
      );
    });

    it("the sender is not an archaeologist on the sarcophagus", async function () {
      const { archaeologistFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);

      const tx = archaeologistFacet
        .connect(sarcophagusData.embalmer)
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );
      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `ArchaeologistNotOnSarcophagus`
      );
    });
    it("the archaeologist has been accused", async function () {
      const { archaeologistFacet, thirdPartyFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      await thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .accuse(
          sarcophagusData.sarcoId,
          [hashShare(archaeologists[0].rawKeyShare)],
          sarcophagusData.embalmer.address
        );

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `ArchaeologistHasBeenAccused`
      );
    });
    it("the archaeologist has already published their key share", async function () {
      const { archaeologistFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      await archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );
      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `ArchaeologistAlreadyUnwrapped`
      );
    });
    it("the key share being published does not match the double hash on the cursedArchaeologist", async function () {
      const { archaeologistFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[1].rawKeyShare
        );
      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `UnencryptedShardHashMismatch`
      );
    });
  });

  describe("Successfully publishes a keyshare", function () {
    it("updates the cursedArchaeologist on the sarcophagus with the rawKeyShare that was published", async function () {
      const { archaeologistFacet, viewStateFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      await archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );

      const cursedArchaeologist =
        await viewStateFacet.getSarcophagusArchaeologist(
          sarcophagusData.sarcoId,
          archaeologists[0].archAddress
        );
      await expect(cursedArchaeologist.rawKeyShare).to.equal(
        "0x" + archaeologists[0].rawKeyShare.toString("hex")
      );
    });
    it("returns the locked bond for the cursed archaeologist equal to their digging fees on the sarcophagus", async function () {
      const { archaeologistFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      // save starting free and locked bonds for all archaeologists
      const prePublishFreeBondSarquitos =
        await getArchaeologistFreeBondSarquitos(archaeologists[0].archAddress);
      const prePublishLockedBondSarquitos =
        await getArchaeologistLockedBondSarquitos(
          archaeologists[0].archAddress
        );

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      await archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );

      const postPublishFreeBondSarquitos =
        await getArchaeologistFreeBondSarquitos(archaeologists[0].archAddress);
      const postPublishLockedBondSarquitos =
        await getArchaeologistLockedBondSarquitos(
          archaeologists[0].archAddress
        );

      expect(postPublishFreeBondSarquitos).to.equal(
        prePublishFreeBondSarquitos.add(archaeologists[0].diggingFeeSarquitos)
      );

      expect(postPublishLockedBondSarquitos).to.equal(
        prePublishLockedBondSarquitos.sub(archaeologists[0].diggingFeeSarquitos)
      );
    });
    it("pays the archaologist their digging fees", async function () {
      const { archaeologistFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );
      await expect(tx).to.emit(archaeologistFacet, `PublishKeyShare`);
    });
    it("stores the sarcoId in archaeologistSuccesses", async function () {
      const { archaeologistFacet, viewStateFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      await archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );
      const successCount = await viewStateFacet.getArchaeologistSuccessesCount(
        archaeologists[0].archAddress
      );
      await expect(successCount).to.equal(1);

      const archaeologistSuccessOnSarcophagus =
        await viewStateFacet.getArchaeologistSuccessOnSarcophagus(
          archaeologists[0].archAddress,
          sarcophagusData.sarcoId
        );
      await expect(archaeologistSuccessOnSarcophagus).to.equal(true);
    });
    it("emits PublishKeyShare", async function () {
      const { archaeologistFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishKeyShare(
          sarcophagusData.sarcoId,
          archaeologists[0].rawKeyShare
        );
      await expect(tx).to.emit(archaeologistFacet, `PublishKeyShare`);
    });
  });
});
