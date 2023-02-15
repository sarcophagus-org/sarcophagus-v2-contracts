import "@nomicfoundation/hardhat-chai-matchers";
import { getContracts } from "../helpers/contracts";
import { createSarcophagusWithRegisteredCursedArchaeologists } from "../helpers/sarcophagus";
import { expect } from "chai";
import {
  accuseArchaeologistsOnSarcophagus,
  compromiseSarcophagus,
} from "../helpers/accuse";
import { accountGenerator } from "../helpers/accounts";
import time from "../../utils/time";
import { ArchaeologistData } from "../helpers/archaeologistSignature";
import { getSarquitoBalance } from "../helpers/sarcoToken";
import { getDiggingFeesPlusProtocolFeesSarquitos } from "../helpers/diggingFees";
import { BigNumber } from "ethers";

const { deployments, ethers } = require("hardhat");

describe("EmbalmerFacet.rewrapSarcophagus", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => {
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  describe("Validates parameters. Should revert if:", function () {
    it("no sarcophagus with the supplied id exists", async function () {
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
    it("the sarcophagus has been compromised", async function () {
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
    it("the sarcophagus has been buried", async function () {
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
    it("the sender is not the embalmer", async function () {
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
    it("the resurrection time has passed", async function () {
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
    it("the new resurrection time is not in the future", async function () {
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
    it("the new resurrection time exceeds sarcophagus maximumRewrapInterval", async function () {
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

    it("the new resurrection time exceeds sarcophagus maximumResurrectionTime", async function () {
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

    it("there is not enough digging fees to cover the new locked bond amount", async function () {
      // Increase interval by 3x and expect the transaction to be reverted

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

  describe.only("Successfully rewraps a sarcophagus with no accusals", function () {
    it("Should pay digging fees to each of the cursed archaeologists", async function () {
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
              startingArchaeologistRewards[index].add(diggingFeesDue)
            );
          }
        )
      );
    });

    it("Should charge the embalmer the total digging fees for all archaeologists plus the protocol fees", async function () {
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
        resurrectionTimeInterval
      );

      expect(
        await getSarquitoBalance(sarcophagusData.embalmer.address)
      ).to.equal(startingEmbalmerBalanceSarquitos.sub(totalCostToEmbalmer));
    });

    it("Should update the resurrectionTime and emit RewrapSarcophagus", async function () {
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

    describe("New digging fees is greater than previous digging fees", function () {
      it("Should increase the archaeologist's cursed bond", function () {
        //
      });
      it("Should decrease archaeologist's rewards", function () {
        //
      });
    });

    describe("New digging fees are less than previous digging fees", function () {
      it("Should decrease cursed bond and increase free bond for the archaeologist", async function () {
        //
      });
    });
  });
  describe("Successfully rewraps a sarcophagus with fewer than k accusals", function () {
    it("Should not pay digging fees to accused archaeologists", async function () {
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
                startingArchaeologistRewards[index].add(diggingFeesDue)
              );
            }
          }
        )
      );
    });

    it("Should exclude accused archaeologist digging fees from embalmer costs", async function () {
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
        resurrectionTimeInterval
      );

      expect(
        await getSarquitoBalance(sarcophagusData.embalmer.address)
      ).to.equal(startingEmbalmerBalanceSarquitos.sub(totalCostToEmbalmer));
    });
  });
});
