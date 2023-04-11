import "@nomicfoundation/hardhat-chai-matchers";
import { getContracts } from "../helpers/contracts";
import { createSarcophagusWithRegisteredCursedArchaeologists } from "../helpers/sarcophagus";
import { expect } from "chai";
import {
  accuseArchaeologistsOnSarcophagus,
  compromiseSarcophagus,
} from "../helpers/accuse";
import time from "../../utils/time";
import {
  getArchaeologistFreeBondSarquitos,
  getArchaeologistLockedBondSarquitos,
} from "../helpers/bond";
import { accountGenerator } from "../helpers/accounts";
import { BigNumber } from "ethers";

const { deployments, ethers } = require("hardhat");

describe("ArchaeologistFacet.publishPrivateKey", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => {
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  describe("Validates parameters. Should revert if:", () => {
    it("no sarcophagus with the supplied id exists", async () => {
      const { archaeologistFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          ethers.utils.solidityKeccak256(["string"], ["nonexistent"]),
          archaeologists[0].privateKey
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `SarcophagusDoesNotExist`
      );
    });

    it("the sarcophagus has been compromised", async () => {
      const { archaeologistFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();

      await compromiseSarcophagus(sarcophagusData, archaeologists);

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `SarcophagusCompromised`
      );
    });

    it("the sarcophagus has been buried", async () => {
      const { archaeologistFacet, embalmerFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `SarcophagusInactive`
      );
    });

    it("the resurrection time has not passed", async () => {
      const { archaeologistFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();

      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `TooEarlyForPublish`
      );
    });

    it("the grace period has passed", async () => {
      const { archaeologistFacet, viewStateFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();
      const gracePeriod = await viewStateFacet.getGracePeriod();

      await time.increaseTo(
        sarcophagusData.resurrectionTimeSeconds + gracePeriod.toNumber()
      );

      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `TooLateForPublish`
      );
    });

    it("the sender is not an archaeologist on the sarcophagus", async () => {
      const { archaeologistFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);

      const tx = archaeologistFacet
        .connect(sarcophagusData.embalmer)
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );
      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `ArchaeologistNotOnSarcophagus`
      );
    });

    it("the archaeologist has been accused", async () => {
      const { archaeologistFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();

      await accuseArchaeologistsOnSarcophagus(
        1,
        sarcophagusData.sarcoId,
        archaeologists
      );

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );

      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `ArchaeologistHasBeenAccused`
      );
    });

    it("the archaeologist has already published their key", async () => {
      const { archaeologistFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      await archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );
      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `ArchaeologistAlreadyPublishedPrivateKey`
      );
    });

    it("the private key being published does not match the public key on the cursedArchaeologist", async () => {
      const { archaeologistFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[1].privateKey
        );
      await expect(tx).to.be.revertedWithCustomError(
        archaeologistFacet,
        `ArchaeologistPublishedIncorrectPrivateKey`
      );
    });
  });

  describe("Successfully publishes a private key", () => {
    it("updates the cursedArchaeologist on the sarcophagus with the privateKey that was published", async () => {
      const { archaeologistFacet, viewStateFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      await archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );

      const cursedArchaeologist =
        await viewStateFacet.getSarcophagusArchaeologist(
          sarcophagusData.sarcoId,
          archaeologists[0].archAddress
        );
      await expect(cursedArchaeologist.privateKey).to.equal(
        archaeologists[0].privateKey
      );
    });

    it("returns the locked bond for the cursed archaeologist equal to their digging fees plus curse fee on the sarcophagus", async () => {
      const { archaeologistFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();

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
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );

      const postPublishFreeBondSarquitos =
        await getArchaeologistFreeBondSarquitos(archaeologists[0].archAddress);
      const postPublishLockedBondSarquitos =
        await getArchaeologistLockedBondSarquitos(
          archaeologists[0].archAddress
        );

      const diggingFeesDue = BigNumber.from(
        archaeologists[0].diggingFeePerSecondSarquito
      ).mul(
        sarcophagusData.resurrectionTimeSeconds -
          sarcophagusData.creationTimeSeconds
      );

      const curseFee = BigNumber.from(archaeologists[0].curseFee);

      expect(postPublishFreeBondSarquitos).to.equal(
        prePublishFreeBondSarquitos.add(diggingFeesDue).add(curseFee)
      );

      expect(postPublishLockedBondSarquitos).to.equal(
        prePublishLockedBondSarquitos.sub(diggingFeesDue.add(curseFee))
      );
    });

    it("pays the archaeologist their digging fees", async () => {
      const { archaeologistFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );
      await expect(tx).to.emit(archaeologistFacet, `PublishPrivateKey`);
    });

    it("emits PublishPrivateKey", async function () {
      const { archaeologistFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = archaeologistFacet
        .connect(await ethers.getSigner(archaeologists[0].archAddress))
        .publishPrivateKey(
          sarcophagusData.sarcoId,
          archaeologists[0].privateKey
        );
      await expect(tx).to.emit(archaeologistFacet, `PublishPrivateKey`);
    });
  });
});
