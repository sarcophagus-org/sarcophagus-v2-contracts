import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import time from "../../utils/time";
import { getContracts } from "../helpers/contracts";
import {
  buildCreateSarcophagusArgs,
  createSarcophagusData,
  registerDefaultArchaeologistsAndCreateSignatures,
  registerSarcophagusWithArchaeologists,
} from "../helpers/sarcophagus";
import {
  ArchaeologistData,
  createArchSignature,
} from "../helpers/archaeologistSignature";
import { getFreshAccount } from "../helpers/accounts";
import {
  getArchaeologistFreeBondSarquitos,
  getArchaeologistLockedBondSarquitos,
} from "../helpers/bond";
import { getSarquitoBalance } from "../helpers/sarcoToken";
import { BigNumber } from "ethers";
import { doubleHashShare } from "../helpers/shamirSecretSharing";

const { deployments, ethers } = require("hardhat");

describe("EmbalmerFacet.createSarcophagus", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("Validates parameters", function () {
    it("Should revert if supplied expired sarcophagus parameters", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});
      // set an expired creationTime
      sarcophagusData.creationTime =
        (await time.latest()) - time.duration.weeks(12);

      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);

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

    it("Should revert if supplied resurrection time that has passed", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});
      // set current time to resurrectionTime
      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      // update creationTime so sarcophagus parameters are not expired
      sarcophagusData.creationTime = await time.latest();
      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `ResurrectionTimeInPast`
      );
    });
    it("Should revert if supplied resurrection time is after maximumRewrapInterval", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});
      // set resurrectionTime to be greater than maximumRewrapInterval
      sarcophagusData.resurrectionTimeSeconds =
        (await time.latest()) +
        sarcophagusData.maximumRewrapIntervalSeconds +
        time.duration.minutes(1);
      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `ResurrectionTimeTooFarInFuture`
      );
    });
    it("Should revert if no archaeologists are supplied", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({
        threshold: 1,
        totalShares: 1,
        maximumRewrapIntervalSeconds: time.duration.weeks(4),
      });

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(...buildCreateSarcophagusArgs(sarcophagusData, []));

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `NoArchaeologistsProvided`
      );
    });
    it("Should revert if supplied threshold is zero", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({
        threshold: 1,
        totalShares: 1,
        maximumRewrapIntervalSeconds: time.duration.weeks(4),
      });

      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);
      sarcophagusData.threshold = 0;
      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `MinShardsZero`
      );
    });
    it("Should revert if supplied threshold is greater than total number of archaeologists", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({
        threshold: 1,
        totalShares: 1,
        maximumRewrapIntervalSeconds: time.duration.weeks(4),
      });
      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);

      sarcophagusData.threshold = 2;
      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );
      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `MinShardsGreaterThanArchaeologists`
      );
    });
    it("Should revert if one of the supplied archaeologists doesn't have a registered profile", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});
      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);

      const unregisteredArchaeologistData = await createArchSignature(
        await getFreshAccount(),
        {
          arweaveTxId: sarcophagusData.arweaveTxIds[1],
          rawKeyShare: sarcophagusData.rawKeyShares[0],
          maximumRewrapIntervalSeconds:
            sarcophagusData.maximumRewrapIntervalSeconds,
          creationTime: sarcophagusData.creationTime,
          diggingFeeSarco: 100,
        }
      );
      archaeologists[0] = unregisteredArchaeologistData;
      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `ArchaeologistProfileExistsShouldBe`
      );
    });
    it("Should revert if the archaeologist list contains duplicates", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});
      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);

      const duplicateArchaeologist = await createArchSignature(
        // reuse signer from first archaeologist
        await ethers.getSigner(archaeologists[0].archAddress),
        {
          arweaveTxId: sarcophagusData.arweaveTxIds[1],
          rawKeyShare: sarcophagusData.rawKeyShares[1],
          maximumRewrapIntervalSeconds:
            sarcophagusData.maximumRewrapIntervalSeconds,
          creationTime: sarcophagusData.creationTime,
          diggingFeeSarco: 100,
        }
      );
      archaeologists[1] = duplicateArchaeologist;
      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `ArchaeologistListNotUnique`
      );
    });
  });
  describe("Validates archaeologist signatures", function () {
    it("Should revert if an archaeologist has not signed off on their assigned doubleHashedKeyShare", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});

      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);
      // alter doubleHashedKeyShare being supplied to the create call after signatures are generated using the original value
      archaeologists[0].doubleHashedKeyShare = doubleHashShare(
        Buffer.from("invalid")
      );

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `InvalidSignature`
      );
    });
    it("Should revert if an archaeologist has not signed off on their assigned diggingFee", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});

      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);
      // alter diggingFeeSarquitos being supplied to the create call after signatures are generated using the original value
      archaeologists[0].diggingFeeSarquitos = "8";

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `InvalidSignature`
      );
    });
    it("Should revert if an archaeologist has not signed off on the sarcophagus creationTime", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});

      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);
      // alter creationTime being supplied to the create call after signatures are generated using the original value
      sarcophagusData.creationTime = (await time.latest()) - 10;

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `InvalidSignature`
      );
    });
    it("Should revert if an archaeologist has not signed off on the sarcophagus maximumRewrapIntervalSeconds", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});

      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);
      // alter maximumRewrapInterval being supplied to the create call after signatures are generated using the original value
      sarcophagusData.maximumRewrapIntervalSeconds =
        sarcophagusData.maximumRewrapIntervalSeconds + 1;

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `InvalidSignature`
      );
    });
  });

  describe("Successfully creates a sarcophagus", function () {
    it("Should lock bond equal to the supplied archaeologist's diggingFee property for the sarcophagus", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});

      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);

      // save starting free and locked bonds for all archaeologists
      const startingArchaeologistBonds = await Promise.all(
        archaeologists.map(async (archaeologist: ArchaeologistData) => ({
          freeBond: await getArchaeologistFreeBondSarquitos(
            archaeologist.archAddress
          ),
          lockedBond: await getArchaeologistLockedBondSarquitos(
            archaeologist.archAddress
          ),
        }))
      );

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      // check post curse bond on all archaeologists
      await Promise.all(
        archaeologists.map(
          async (archaeologist: ArchaeologistData, index: number) => {
            const archaeologistPostCurseFreeBond =
              await getArchaeologistFreeBondSarquitos(
                archaeologist.archAddress
              );
            const archaeologistPostCurseLockedBond =
              await getArchaeologistLockedBondSarquitos(
                archaeologist.archAddress
              );

            expect(archaeologistPostCurseFreeBond.toString()).to.equal(
              startingArchaeologistBonds[index].freeBond.sub(
                archaeologist.diggingFeeSarquitos.toString()
              )
            );

            expect(archaeologistPostCurseLockedBond.toString()).to.equal(
              startingArchaeologistBonds[index].lockedBond.add(
                archaeologist.diggingFeeSarquitos.toString()
              )
            );
          }
        )
      );
    });
    it("Should charge the embalmer the total of all locked bonds plus the protocol fees", async function () {
      const { embalmerFacet, viewStateFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});

      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);

      // save starting embalmer balance
      const startingEmbalmerSarquitoBalance = await getSarquitoBalance(
        sarcophagusData.embalmer.address
      );

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );

      const postCreationSarquitoBalance = await getSarquitoBalance(
        sarcophagusData.embalmer.address
      );

      const totalDiggingFees: BigNumber = archaeologists.reduce(
        (sum: BigNumber, archaeologist: ArchaeologistData) =>
          sum.add(BigNumber.from(archaeologist.diggingFeeSarquitos)),
        BigNumber.from(0)
      );
      const totalCostToEmbalmer = totalDiggingFees.add(
        totalDiggingFees
          .mul(await viewStateFacet.getProtocolFeeBasePercentage())
          .div(100)
      );
      expect(postCreationSarquitoBalance.toString()).to.equal(
        startingEmbalmerSarquitoBalance.sub(totalCostToEmbalmer).toString()
      );
    });
    it("Should store all selected archaeologists on the newly created sarcophagus", async function () {
      const { viewStateFacet } = await getContracts();
      const { archaeologists, sarcophagusData } =
        await registerSarcophagusWithArchaeologists();

      const sarcophagusResult = await viewStateFacet.getSarcophagus(
        sarcophagusData.sarcoId
      );
      expect(sarcophagusResult.archaeologistAddresses).to.deep.equal(
        archaeologists.map((a) => a.archAddress)
      );
    });
    it("Should store all supplied sarcophagus parameters on the newly created sarcophagus", async function () {
      const { viewStateFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      const sarcophagusResult = await viewStateFacet.getSarcophagus(
        sarcophagusData.sarcoId
      );
      expect(sarcophagusResult.resurrectionTime).to.equal(
        sarcophagusData.resurrectionTimeSeconds
      );
      expect(sarcophagusResult.name).to.equal(sarcophagusData.name);
      expect(sarcophagusResult.threshold).to.equal(sarcophagusData.threshold);
      expect(sarcophagusResult.maximumRewrapInterval).to.equal(
        sarcophagusData.maximumRewrapIntervalSeconds
      );
      expect(sarcophagusResult.arweaveTxIds).to.deep.equal(
        sarcophagusData.arweaveTxIds
      );
      expect(sarcophagusResult.embalmerAddress).to.equal(
        sarcophagusData.embalmer.address
      );
      expect(sarcophagusResult.recipientAddress).to.equal(
        sarcophagusData.recipientAddress
      );

      expect(sarcophagusResult.isCompromised).to.equal(false);
      expect(sarcophagusResult.publishedKeyShareCount).to.equal(0);
      expect(sarcophagusResult.hasLockedBond).to.equal(true);
    });
    it("Should update convenience lookup data structures with the new sarcophagus", async function () {
      const { viewStateFacet } = await getContracts();
      const { archaeologists, sarcophagusData } =
        await registerSarcophagusWithArchaeologists();

      const archaeologistSarcophagi =
        await viewStateFacet.getArchaeologistSarcophagi(
          archaeologists[0].archAddress
        );
      expect(archaeologistSarcophagi).contains(sarcophagusData.sarcoId);

      const embalmerSarcophagi = await viewStateFacet.getEmbalmerSarcophagi(
        sarcophagusData.embalmer.address
      );
      expect(embalmerSarcophagi).contains(sarcophagusData.sarcoId);

      const recipientSarcophagi = await viewStateFacet.getRecipientSarcophagi(
        sarcophagusData.recipientAddress
      );
      expect(recipientSarcophagi).contains(sarcophagusData.sarcoId);

      // todo: if we keep sarcophagusIdentifiers, add an accessor
      // s.sarcophagusIdentifiers.push(sarcoId);
    });

    it("Should emit CreateSarcophagus", async function () {
      const { embalmerFacet } = await getContracts();
      const sarcophagusData = await createSarcophagusData({});

      const archaeologists =
        await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .createSarcophagus(
          ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
        );
      await expect(tx).to.emit(embalmerFacet, "CreateSarcophagus");
    });
  });
});
