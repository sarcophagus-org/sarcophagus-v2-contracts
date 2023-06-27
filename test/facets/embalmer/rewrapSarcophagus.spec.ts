import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { formatEther } from "ethers/lib/utils";
import time from "../../utils/time";
import { accountGenerator } from "../helpers/accounts";
import {
  accuseArchaeologistsOnSarcophagus,
  compromiseSarcophagus,
} from "../helpers/accuse";
import { ArchaeologistData } from "../helpers/archaeologistSignature";
import { getContracts } from "../helpers/contracts";
import { getDiggingFeesPlusProtocolFeesSarquitos } from "../helpers/diggingFees";
import { createSarcophagusWithRegisteredCursedArchaeologists } from "../helpers/sarcophagus";
import { getSarquitoBalance } from "../helpers/sarcoToken";

const { deployments, ethers } = require("hardhat");

describe("EmbalmerFacet.rewrapSarcophagus", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => {
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  describe("Validates parameters. Should revert if:", () => {
    it("no sarcophagus with the supplied id exists", async () => {
      const { embalmerFacet } = await getContracts();
      const { createdSarcophagusData: sarcophagusData } =
        await createSarcophagusWithRegisteredCursedArchaeologists();

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
    it("the sarcophagus has been compromised", async () => {
      const { embalmerFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();

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
    it("the sarcophagus has been buried", async () => {
      const { embalmerFacet } = await getContracts();
      const { createdSarcophagusData: sarcophagusData } =
        await createSarcophagusWithRegisteredCursedArchaeologists();

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
    it("the sender is not the embalmer", async () => {
      const { embalmerFacet } = await getContracts();
      const { createdSarcophagusData: sarcophagusData } =
        await createSarcophagusWithRegisteredCursedArchaeologists();

      const tx = embalmerFacet
        .connect(await accountGenerator.newAccount())
        .rewrapSarcophagus(
          sarcophagusData.sarcoId,
          sarcophagusData.resurrectionTimeSeconds
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SenderNotEmbalmer`
      );
    });
    it("the resurrection time has passed", async () => {
      const { embalmerFacet } = await getContracts();
      const { createdSarcophagusData: sarcophagusData } =
        await createSarcophagusWithRegisteredCursedArchaeologists();

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
    it("the new resurrection time is not in the future", async () => {
      const { embalmerFacet } = await getContracts();
      const { createdSarcophagusData: sarcophagusData } =
        await createSarcophagusWithRegisteredCursedArchaeologists();

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(sarcophagusData.sarcoId, await time.latest());

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `NewResurrectionTimeInPast`
      );
    });
    it("the new resurrection time exceeds sarcophagus maximumRewrapInterval", async () => {
      const { embalmerFacet } = await getContracts();
      const { createdSarcophagusData: sarcophagusData } =
        await createSarcophagusWithRegisteredCursedArchaeologists();

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
        `NewResurrectionTimeTooFarInFuture`
      );
    });

    it("the new resurrection time exceeds sarcophagus maximumResurrectionTime", async () => {
      const { embalmerFacet } = await getContracts();
      const { createdSarcophagusData: sarcophagusData } =
        await createSarcophagusWithRegisteredCursedArchaeologists();

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(
          sarcophagusData.sarcoId,
          (await time.latest()) +
            sarcophagusData.maximumResurrectionTimeSeconds +
            time.duration.minutes(1)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `NewResurrectionTimeTooFarInFuture`
      );
    });

    it("there is not enough digging fees to cover the new locked bond amount", async () => {
      const { embalmerFacet } = await getContracts();

      // Set resurrection time to 1 week from now
      const resurrectionTime = (await time.latest()) + time.duration.weeks(1);
      const { createdSarcophagusData: sarcophagusData } =
        await createSarcophagusWithRegisteredCursedArchaeologists({
          resurrectionTime,
        });

      // Increase resurrection time to 3 weeks from now, 3x the original
      // Less than max res time but way more than double previous res time
      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(
          sarcophagusData.sarcoId,
          (await time.latest()) + time.duration.weeks(3)
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `ResurrectionTimeTooFarPastPreviousResurrectionTime`
      );
    });
  });

  describe("Successfully rewraps a sarcophagus with no accusals", () => {
    it("Should pay digging fees to each of the cursed archaeologists", async () => {
      const { embalmerFacet, viewStateFacet, sarcoToken } =
        await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();

      // save starting free and locked bonds for all archaeologists
      const startingArchaeologistRewards = await Promise.all(
        archaeologists.map(
          async (archaeologist: ArchaeologistData) =>
            await viewStateFacet.getRewards(archaeologist.archAddress)
        )
      );

      // embalmer does not have enough eth
      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(
          sarcophagusData.sarcoId,
          sarcophagusData.resurrectionTimeSeconds
        );

      // check post rewrap rewards on all archaeologists
      await Promise.all(
        archaeologists.map(
          async (archaeologist: ArchaeologistData, index: number) => {
            const archaeologistPostRewrapRewards =
              await viewStateFacet.getRewards(archaeologist.archAddress);

            const diggingFeesDue = BigNumber.from(
              archaeologist.diggingFeePerSecondSarquito
            ).mul(
              sarcophagusData.resurrectionTimeSeconds -
                sarcophagusData.creationTimeSeconds
            );

            expect(archaeologistPostRewrapRewards).to.equal(
              startingArchaeologistRewards[index]
                .add(diggingFeesDue)
                .add(archaeologist.curseFee)
            );
          }
        )
      );
    });

    it("Should charge the embalmer the total digging fees for all archaeologists plus the protocol fees", async () => {
      const { embalmerFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();

      // save embalmer balance before rewrap
      const startingEmbalmerBalanceSarquitos = await getSarquitoBalance(
        sarcophagusData.embalmer.address
      );

      const newResurrectionTime =
        (await time.latest()) +
        sarcophagusData.maximumRewrapIntervalSeconds -
        time.duration.hours(1);

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(sarcophagusData.sarcoId, newResurrectionTime);

      const currentTime = await time.latest();
      const resurrectionTimeInterval = newResurrectionTime - currentTime;

      const totalCostToEmbalmer = await getDiggingFeesPlusProtocolFeesSarquitos(
        archaeologists,
        resurrectionTimeInterval,
        false
      );

      const actualBalance = await getSarquitoBalance(
        sarcophagusData.embalmer.address
      );
      const expectedBalance =
        startingEmbalmerBalanceSarquitos.sub(totalCostToEmbalmer);

      expect(
        await getSarquitoBalance(sarcophagusData.embalmer.address)
      ).to.equal(startingEmbalmerBalanceSarquitos.sub(totalCostToEmbalmer));
    });

    it("Should update the resurrectionTime and emit RewrapSarcophagus", async () => {
      const { embalmerFacet, viewStateFacet } = await getContracts();
      const { createdSarcophagusData: sarcophagusData } =
        await createSarcophagusWithRegisteredCursedArchaeologists();

      const newResurrectionTime =
        (await time.latest()) +
        sarcophagusData.maximumRewrapIntervalSeconds -
        time.duration.hours(1);

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(sarcophagusData.sarcoId, newResurrectionTime);

      const result = await viewStateFacet.getSarcophagus(
        sarcophagusData.sarcoId
      );

      expect(result.resurrectionTime).to.equal(newResurrectionTime);
      await expect(tx).to.emit(embalmerFacet, "RewrapSarcophagus");
    });

    it("Should increase the cursed bond and decrease the rewards if new digging fee > previous digging fee", async () => {
      const { embalmerFacet, viewStateFacet } = await getContracts();

      // Set resurrection time for creation to 1 week from now
      const resurrectionTimeOnCreate =
        (await time.latest()) + time.duration.weeks(1);

      // Set resurrection time for rewrap to 1.5 weeks from now
      const resurrectionTimeOnRewrap =
        (await time.latest()) + time.duration.weeks(1.5);

      const { createdSarcophagusData: sarcophagusData, cursedArchaeologists } =
        await createSarcophagusWithRegisteredCursedArchaeologists({
          resurrectionTime: resurrectionTimeOnCreate,
        });

      const cursedBondPercentage = await viewStateFacet
        .connect(sarcophagusData.embalmer)
        .getCursedBondPercentage();

      const curseFee = cursedArchaeologists[0].curseFee;

      // Get an archaeologist address
      const sarcophagus = await viewStateFacet.getSarcophagus(
        sarcophagusData.sarcoId
      );
      const firstArchaeologistAddress = sarcophagus.archaeologistAddresses[0];

      // Get the first archaeologist's cursed bond before rewrap
      const cursedBondBefore = await viewStateFacet.getCursedBond(
        firstArchaeologistAddress
      );

      const cursedBondBeforeMinusCurseFeeBond = cursedBondBefore.sub(
        BigNumber.from(curseFee).mul(cursedBondPercentage).div(10000)
      );

      // Get the archaeologist's rewards before rewrap
      const rewardsBefore = await viewStateFacet.getRewards(
        firstArchaeologistAddress
      );

      // Get first archaeologist's digging fees per second
      const diggingFeePerSecond = (
        await viewStateFacet.getArchaeologistProfile(firstArchaeologistAddress)
      ).minimumDiggingFeePerSecond;

      // Rewrap sarcophagus
      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(sarcophagusData.sarcoId, resurrectionTimeOnRewrap);

      // Get the first archaeologist's cursed bond after rewrap
      const cursedBondAfter = await viewStateFacet.getCursedBond(
        firstArchaeologistAddress
      );

      // Get the archaeologist's rewards after rewrap
      const rewardsAfter = await viewStateFacet.getRewards(
        firstArchaeologistAddress
      );

      const prevDiggingFees = diggingFeePerSecond.mul(
        sarcophagus.resurrectionTime.sub(sarcophagus.previousRewrapTime)
      );

      const newDiggingFees = diggingFeePerSecond.mul(
        BigNumber.from(resurrectionTimeOnRewrap).sub(
          BigNumber.from(await time.latest())
        )
      );

      const diggingFeesDiff = newDiggingFees.sub(prevDiggingFees);
      const cursedBondDiff = diggingFeesDiff.mul(cursedBondPercentage).div(10000);

      // Expect the cursed bond after - cursed bond before to be equal to the difference in digging fees
      expect(cursedBondAfter.sub(cursedBondBeforeMinusCurseFeeBond)).to.equal(
        cursedBondDiff
      );

      // Expect the rewards after - rewards before to be equal to previous digging fee - the digging fee difference
      expect(rewardsAfter.sub(curseFee).sub(rewardsBefore)).to.equal(
        prevDiggingFees.sub(diggingFeesDiff)
      );
    });

    it("Should decrease cursed bond and increase free bond if new digging fee < previous digging fee ", async () => {
      const { embalmerFacet, viewStateFacet } = await getContracts();

      // Set resurrection time for creation to 1 week from now
      const resurrectionTimeOnCreate =
        (await time.latest()) + time.duration.weeks(1);

      // Set resurrection time for rewrap to 0.5 weeks from now
      const resurrectionTimeOnRewrap =
        (await time.latest()) + time.duration.weeks(0.5);

      const { createdSarcophagusData: sarcophagusData, cursedArchaeologists } =
        await createSarcophagusWithRegisteredCursedArchaeologists({
          resurrectionTime: resurrectionTimeOnCreate,
        });

      const cursedBondPercentage = await viewStateFacet
        .connect(sarcophagusData.embalmer)
        .getCursedBondPercentage();

      const curseFee = cursedArchaeologists[0].curseFee;

      // Get an archaeologist address
      const sarcophagus = await viewStateFacet.getSarcophagus(
        sarcophagusData.sarcoId
      );
      const firstArchaeologistAddress = sarcophagus.archaeologistAddresses[0];

      // Get the first archaeologist's cursed bond before rewrap
      const cursedBondBefore = await viewStateFacet.getCursedBond(
        firstArchaeologistAddress
      );

      const cursedBondBeforeMinusCurseFeeBond = cursedBondBefore.sub(
        BigNumber.from(curseFee).mul(cursedBondPercentage).div(10000)
      );

      // Get the first archaeologist's free bond before rewrap
      const freeBondBefore = await viewStateFacet.getFreeBond(
        firstArchaeologistAddress
      );

      const freeBondBeforeBeforePlusCurseFeeBond = freeBondBefore.add(
        BigNumber.from(curseFee).mul(cursedBondPercentage).div(10000)
      );

      // Get the archaeologist's rewards before rewrap
      const rewardsBefore = await viewStateFacet.getRewards(
        firstArchaeologistAddress
      );

      // Get first archaeologist's digging fees per second
      const diggingFeePerSecond = (
        await viewStateFacet.getArchaeologistProfile(firstArchaeologistAddress)
      ).minimumDiggingFeePerSecond;

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(sarcophagusData.sarcoId, resurrectionTimeOnRewrap);

      // Get the first archaeologist's cursed bond after rewrap
      const cursedBondAfter = await viewStateFacet.getCursedBond(
        firstArchaeologistAddress
      );

      // Get the first archaeologist's free bond after rewrap
      const freeBondAfter = await viewStateFacet.getFreeBond(
        firstArchaeologistAddress
      );

      // Get the archaeologist's rewards after rewrap
      const rewardsAfter = await viewStateFacet.getRewards(
        firstArchaeologistAddress
      );

      const prevDiggingFees = diggingFeePerSecond.mul(
        sarcophagus.resurrectionTime.sub(sarcophagus.previousRewrapTime)
      );

      const newDiggingFees = diggingFeePerSecond.mul(
        BigNumber.from(resurrectionTimeOnRewrap).sub(
          BigNumber.from(await time.latest())
        )
      );

      const diggingFeesDiff = prevDiggingFees.sub(newDiggingFees);

      // Expect the difference in cursed bond to be equal to the difference in diggingFees
      expect(cursedBondBeforeMinusCurseFeeBond.sub(cursedBondAfter)).to.equal(
        diggingFeesDiff
      );

      // Expect the difference in free bond to be equal to the difference in diggingFees
      expect(freeBondAfter.sub(freeBondBeforeBeforePlusCurseFeeBond)).to.equal(
        diggingFeesDiff
      );

      // Expect the difference in rewards to be equal to the previous digging fees
      expect(rewardsAfter.sub(curseFee).sub(rewardsBefore)).to.equal(
        prevDiggingFees
      );
    });

    it("Should not change bonds if new digging fee == previous digging fee ", async function () {
      const { embalmerFacet, viewStateFacet } = await getContracts();

      const creationTimestamp = await time.latest();

      // Set resurrection time for creation to have the same rewrap interval as the new one
      const resurrectionTimeOnCreate =
        creationTimestamp + time.duration.weeks(1);

      const { createdSarcophagusData: sarcophagusData, cursedArchaeologists } =
        await createSarcophagusWithRegisteredCursedArchaeologists({
          creationTimeSeconds: creationTimestamp,
          resurrectionTime: resurrectionTimeOnCreate,
        });
      const interval = resurrectionTimeOnCreate - creationTimestamp;

      const resurrectionTimeOnRewrap = resurrectionTimeOnCreate;

      const cursedBondPercentage = await viewStateFacet
        .connect(sarcophagusData.embalmer)
        .getCursedBondPercentage();

      const curseFee = cursedArchaeologists[0].curseFee;

      // Get an archaeologist address
      const sarcophagus = await viewStateFacet.getSarcophagus(
        sarcophagusData.sarcoId
      );
      const firstArchaeologistAddress = sarcophagus.archaeologistAddresses[0];

      // Get the first archaeologist's cursed bond before rewrap
      const cursedBondBefore = await viewStateFacet.getCursedBond(
        firstArchaeologistAddress
      );

      const cursedBondBeforeMinusCurseFeeBond = cursedBondBefore.sub(
        BigNumber.from(curseFee).mul(cursedBondPercentage).div(10000)
      );

      // Get the first archaeologist's free bond before rewrap
      const freeBondBefore = await viewStateFacet.getFreeBond(
        firstArchaeologistAddress
      );

      const freeBondBeforeBeforePlusCurseFeeBond = freeBondBefore.add(
        BigNumber.from(curseFee).mul(cursedBondPercentage).div(10000)
      );

      // Get the archaeologist's rewards before rewrap
      const rewardsBefore = await viewStateFacet.getRewards(
        firstArchaeologistAddress
      );

      const rewrapTimestamp = creationTimestamp + 10000;

      await time.increaseTo(rewrapTimestamp);

      // Get the first archaeologist's digging fees per second
      const diggingFeePerSecond = (
        await viewStateFacet.getArchaeologistProfile(firstArchaeologistAddress)
      ).minimumDiggingFeePerSecond;

      // Call the rewrapSarcophagus function
      // Adding 1 second to the timestamp to account for the difference between on chain timestamp and local timestamp
      // This value is very consistent in this test
      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(
          sarcophagusData.sarcoId,
          rewrapTimestamp + interval + 1
        );

      // Get the first archaeologist's cursed bond after rewrap
      const cursedBondAfter = await viewStateFacet.getCursedBond(
        firstArchaeologistAddress
      );

      // Get the first archaeologist's free bond after rewrap
      const freeBondAfter = await viewStateFacet.getFreeBond(
        firstArchaeologistAddress
      );

      // Get the archaeologist's rewards after rewrap
      const rewardsAfter = await viewStateFacet.getRewards(
        firstArchaeologistAddress
      );

      const prevDiggingFees = diggingFeePerSecond.mul(
        sarcophagus.resurrectionTime.sub(sarcophagus.previousRewrapTime)
      );

      const newDiggingFees = diggingFeePerSecond.mul(
        BigNumber.from(resurrectionTimeOnRewrap).sub(
          BigNumber.from(await time.latest())
        )
      );

      expect(cursedBondBeforeMinusCurseFeeBond.sub(cursedBondAfter)).to.equal(
        0
      );

      expect(freeBondAfter.sub(freeBondBeforeBeforePlusCurseFeeBond)).to.equal(
        0
      );

      expect(rewardsAfter.sub(curseFee).sub(rewardsBefore)).to.equal(
        prevDiggingFees
      );
    });
  });
  describe("Successfully rewraps a sarcophagus with fewer than k accusals", () => {
    it("Should not pay digging fees to accused archaeologists", async () => {
      const { embalmerFacet, viewStateFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();

      // save starting free and locked bonds for all archaeologists
      const startingArchaeologistRewards = await Promise.all(
        archaeologists.map(
          async (archaeologist: ArchaeologistData) =>
            await viewStateFacet.getRewards(archaeologist.archAddress)
        )
      );
      const { accusedArchaeologists } = await accuseArchaeologistsOnSarcophagus(
        sarcophagusData.threshold - 1,
        sarcophagusData.sarcoId,
        archaeologists
      );
      const accusedArchaeologistAddresses = accusedArchaeologists.map(
        (accusedArchaeologist: ArchaeologistData) =>
          accusedArchaeologist.archAddress
      );

      const currentTime = await time.latest();
      const newResurrectionTime =
        currentTime +
        sarcophagusData.maximumRewrapIntervalSeconds -
        time.duration.hours(1);

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(sarcophagusData.sarcoId, newResurrectionTime);

      // check post rewrap rewards on all archaeologists
      await Promise.all(
        archaeologists.map(
          async (archaeologist: ArchaeologistData, index: number) => {
            const archaeologistPostRewrapRewards =
              await viewStateFacet.getRewards(archaeologist.archAddress);
            // verify accused archaeologists have not received rewards
            if (
              accusedArchaeologistAddresses.includes(archaeologist.archAddress)
            ) {
              expect(archaeologistPostRewrapRewards).to.equal(
                startingArchaeologistRewards[index]
              );
            } else {
              const diggingFeesDue = BigNumber.from(
                archaeologist.diggingFeePerSecondSarquito
              ).mul(
                sarcophagusData.resurrectionTimeSeconds -
                  sarcophagusData.creationTimeSeconds
              );

              expect(archaeologistPostRewrapRewards).to.equal(
                startingArchaeologistRewards[index]
                  .add(diggingFeesDue)
                  .add(archaeologist.curseFee)
              );
            }
          }
        )
      );
    });

    it("Should exclude accused archaeologist digging fees from embalmer costs", async () => {
      const { embalmerFacet } = await getContracts();
      const {
        createdSarcophagusData: sarcophagusData,
        cursedArchaeologists: archaeologists,
      } = await createSarcophagusWithRegisteredCursedArchaeologists();

      await accuseArchaeologistsOnSarcophagus(
        sarcophagusData.threshold - 1,
        sarcophagusData.sarcoId,
        archaeologists
      );
      const innocentArchaeologists = archaeologists.slice(
        sarcophagusData.threshold - 1,
        archaeologists.length
      );

      // save embalmer balance before rewrap
      const startingEmbalmerBalanceSarquitos = await getSarquitoBalance(
        sarcophagusData.embalmer.address
      );

      const newResurrectionTime =
        (await time.latest()) +
        sarcophagusData.maximumRewrapIntervalSeconds -
        time.duration.hours(1);

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .rewrapSarcophagus(sarcophagusData.sarcoId, newResurrectionTime);

      const currentTime = await time.latest();
      const resurrectionTimeInterval = newResurrectionTime - currentTime;

      const totalCostToEmbalmer = await getDiggingFeesPlusProtocolFeesSarquitos(
        innocentArchaeologists,
        resurrectionTimeInterval,
        false
      );

      expect(
        await getSarquitoBalance(sarcophagusData.embalmer.address)
      ).to.equal(startingEmbalmerBalanceSarquitos.sub(totalCostToEmbalmer));
    });
  });
});
