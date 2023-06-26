import { accountGenerator } from "../helpers/accounts";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";
import {
  buildCreateSarcophagusArgs,
  createSarcophagusData,
  createSarcophagusWithRegisteredCursedArchaeologists,
  registerDefaultArchaeologistsAndCreateSignatures,
} from "../helpers/sarcophagus";
import { BigNumber } from "ethers";
import time from "../../utils/time";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { deployments, ethers } = require("hardhat");

describe("AdminFacet.setCursedBondPercentage", () => {
  let deployer: SignerWithAddress;

  context("when caller is not the admin", async () => {
    beforeEach(async () => {
      await deployments.fixture();
      const { adminFacet } = await getContracts();
      deployer = await ethers.getNamedSigner("deployer");
      const signers = await ethers.getSigners();
      await adminFacet.connect(deployer).transferAdmin(signers[1].address);
    });

    it("reverts with the correct error message", async () => {
      const { adminFacet } = await getContracts();
      const setTx = adminFacet.connect(deployer).setCursedBondPercentage(200);
      await expect(setTx).to.be.revertedWithCustomError(
        adminFacet,
        "CallerIsNotAdmin"
      );
    });
  });

  context("when caller is the admin", async () => {
    // reset to directly after the diamond deployment before each test
    beforeEach(async () => {
      deployer = await ethers.getNamedSigner("deployer");
      await deployments.fixture();
      accountGenerator.index = 0;
    });

    it("sets the cursed bond percentage if caller is owner", async () => {
      const { adminFacet, viewStateFacet } = await getContracts();
      await adminFacet.connect(deployer).setCursedBondPercentage(200);

      const cursedBondPercentage = await viewStateFacet
        .connect(deployer)
        .getCursedBondPercentage();
      expect(cursedBondPercentage).to.eq(200);
    });

    it("emits SetCursedBondPercentage", async () => {
      const { adminFacet } = await getContracts();
      const tx = adminFacet.connect(deployer).setCursedBondPercentage(200);
      // @ts-ignore
      await expect(tx).to.emit(adminFacet, `SetCursedBondPercentage`);
    });

    describe("createSarcophagus", () => {
      context("with cursedBondPercentage set to 150", () => {
        beforeEach(async () => {
          const { adminFacet } = await getContracts();
          await adminFacet.connect(deployer).setCursedBondPercentage(150);
        });

        it("locks the correct amount of bond", async () => {
          const { embalmerFacet, viewStateFacet } = await getContracts();
          const sarcophagusData = await createSarcophagusData({});
          const archaeologists =
            await registerDefaultArchaeologistsAndCreateSignatures(
              sarcophagusData
            );
          await embalmerFacet
            .connect(sarcophagusData.embalmer)
            .createSarcophagus(
              ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
            );

          const archaeologist = await viewStateFacet.getArchaeologistProfile(
            archaeologists[0].archAddress
          );

          // Digging fee total is duration of sarcophagus * diggingFeePerSecond + curseFee
          const diggingFeeAmount = BigNumber.from(
            sarcophagusData.resurrectionTimeSeconds -
              sarcophagusData.creationTimeSeconds
          )
            .mul(archaeologist.minimumDiggingFeePerSecond)
            .add(archaeologist.curseFee);

          // Cursed bond should be 1.5x the digging fees
          expect(archaeologist.cursedBond).to.eq(
            diggingFeeAmount.mul(150).div(100)
          );
        });
      });
    });

    describe("rewrapSarcophagus", () => {
      context("with cursedBondPercentage set to 150", () => {
        beforeEach(async () => {
          const { adminFacet } = await getContracts();
          await adminFacet.connect(deployer).setCursedBondPercentage(150);
        });

        it("pays the correct amount of rewards on the first and second rewraps", async () => {
          const { embalmerFacet, viewStateFacet } = await getContracts();
          const sarcophagusData = await createSarcophagusData({});
          const archaeologists =
            await registerDefaultArchaeologistsAndCreateSignatures(
              sarcophagusData
            );
          await embalmerFacet
            .connect(sarcophagusData.embalmer)
            .createSarcophagus(
              ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
            );

          const archaeologist = await viewStateFacet.getArchaeologistProfile(
            archaeologists[0].archAddress
          );

          const diggingFeesDurationFirstRewrap =
            sarcophagusData.resurrectionTimeSeconds -
            sarcophagusData.creationTimeSeconds;

          // On first rewrap, rewards include the curseFee
          const diggingFeeAmountFirstRewrap = BigNumber.from(
            diggingFeesDurationFirstRewrap
          )
            .mul(archaeologist.minimumDiggingFeePerSecond)
            .add(archaeologist.curseFee);

          const newResurrectionTime = (await time.latest()) + 100000;

          await embalmerFacet
            .connect(sarcophagusData.embalmer)
            .rewrapSarcophagus(sarcophagusData.sarcoId, newResurrectionTime);

          const rewardsFirstRewrap = await viewStateFacet
            .connect(archaeologists[0].archAddress)
            .getRewards(archaeologists[0].archAddress);

          expect(rewardsFirstRewrap).to.eq(diggingFeeAmountFirstRewrap);

          // On second rewrap, expect rewards not to include curse fee
          const sarco = await viewStateFacet.getSarcophagus(
            sarcophagusData.sarcoId
          );

          const diggingFeesDurationSecondRewrap = sarco.resurrectionTime.sub(
            sarco.previousRewrapTime
          );

          const diggingFeeAmountSecondRewrap = BigNumber.from(
            diggingFeesDurationSecondRewrap
          ).mul(archaeologist.minimumDiggingFeePerSecond);

          await embalmerFacet
            .connect(sarcophagusData.embalmer)
            .rewrapSarcophagus(sarcophagusData.sarcoId, newResurrectionTime);

          const rewardsSecondRewrap = await viewStateFacet
            .connect(archaeologists[0].archAddress)
            .getRewards(archaeologists[0].archAddress);

          expect(rewardsSecondRewrap.sub(rewardsFirstRewrap)).to.eq(
            diggingFeeAmountSecondRewrap
          );
        });

        it("reverts b/c new resurrection interval is more than 1.666x old interval", async () => {
          const { embalmerFacet } = await getContracts();
          const sarcophagusData = await createSarcophagusData({
            resurrectionTime: (await time.latest()) + 10000,
          });
          const archaeologists =
            await registerDefaultArchaeologistsAndCreateSignatures(
              sarcophagusData
            );
          await embalmerFacet
            .connect(sarcophagusData.embalmer)
            .createSarcophagus(
              ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
            );

          // Set new resurrection interval to ~1.7x the old one
          // The max allowed should be 1.6666x the old one so this should revert
          const tx = embalmerFacet
            .connect(sarcophagusData.embalmer)
            .rewrapSarcophagus(
              sarcophagusData.sarcoId,
              (await time.latest()) + 17000
            );

          // @ts-ignore
          await expect(tx).to.be.reverted;
        });

        it("locks up the correct amount of bond from the digging fees when new interval is longer than previous interval", async () => {
          const { embalmerFacet, viewStateFacet } = await getContracts();
          const sarcophagusData = await createSarcophagusData({
            resurrectionTime: (await time.latest()) + 10000,
          });
          const archaeologists =
            await registerDefaultArchaeologistsAndCreateSignatures(
              sarcophagusData
            );
          await embalmerFacet
            .connect(sarcophagusData.embalmer)
            .createSarcophagus(
              ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
            );

          const archaeologist = await viewStateFacet.getArchaeologistProfile(
            archaeologists[0].archAddress
          );

          const minDiggingFeePerSecond =
            archaeologist.minimumDiggingFeePerSecond;

          const initialResurrectionInterval =
            sarcophagusData.resurrectionTimeSeconds -
            sarcophagusData.creationTimeSeconds;

          const diggingFeeAmount = BigNumber.from(
            initialResurrectionInterval
          ).mul(minDiggingFeePerSecond);

          const originalCursedBond = diggingFeeAmount.mul(150).div(100);

          // Use longer interval than interval used during create (15000 vs. 10000)
          await embalmerFacet
            .connect(sarcophagusData.embalmer)
            .rewrapSarcophagus(
              sarcophagusData.sarcoId,
              (await time.latest()) + 15000
            );

          const cursedArch = await viewStateFacet.getArchaeologistProfile(
            archaeologists[0].archAddress
          );

          const sarco = await viewStateFacet.getSarcophagus(
            sarcophagusData.sarcoId
          );

          const newResurrectionInterval = sarco.resurrectionTime.sub(
            sarco.previousRewrapTime
          );

          const newCursedBond = newResurrectionInterval
            .mul(minDiggingFeePerSecond)
            .mul(150)
            .div(100);

          const rewards = await viewStateFacet
            .connect(archaeologists[0].archAddress)
            .getRewards(archaeologists[0].archAddress);

          const diggingFeesPaidToCursedBond =
            newCursedBond.sub(originalCursedBond);
          const newRewards = diggingFeeAmount.sub(diggingFeesPaidToCursedBond);

          expect(cursedArch.cursedBond).to.eq(newCursedBond);
          expect(rewards).to.eq(newRewards.add(archaeologist.curseFee));
        });

        it("locks up the correct amount of bond from the digging fees when new interval is shorter than previous interval", async () => {
          const { embalmerFacet, viewStateFacet } = await getContracts();
          const sarcophagusData = await createSarcophagusData({
            resurrectionTime: (await time.latest()) + 10000,
          });
          const archaeologists =
            await registerDefaultArchaeologistsAndCreateSignatures(
              sarcophagusData
            );
          await embalmerFacet
            .connect(sarcophagusData.embalmer)
            .createSarcophagus(
              ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
            );

          const archaeologist = await viewStateFacet.getArchaeologistProfile(
            archaeologists[0].archAddress
          );

          const minDiggingFeePerSecond =
            archaeologist.minimumDiggingFeePerSecond;

          const initialResurrectionInterval =
            sarcophagusData.resurrectionTimeSeconds -
            sarcophagusData.creationTimeSeconds;

          const diggingFeeAmount = BigNumber.from(
            initialResurrectionInterval
          ).mul(minDiggingFeePerSecond);

          // Use shorter interval than interval used during create (5000 vs. 10000)
          await embalmerFacet
            .connect(sarcophagusData.embalmer)
            .rewrapSarcophagus(
              sarcophagusData.sarcoId,
              (await time.latest()) + 5000
            );

          const cursedArch = await viewStateFacet.getArchaeologistProfile(
            archaeologists[0].archAddress
          );

          const sarco = await viewStateFacet.getSarcophagus(
            sarcophagusData.sarcoId
          );

          const newResurrectionInterval = sarco.resurrectionTime.sub(
            sarco.previousRewrapTime
          );

          const newCursedBond = newResurrectionInterval
            .mul(minDiggingFeePerSecond)
            .mul(150)
            .div(100);

          const rewards = await viewStateFacet
            .connect(archaeologists[0].archAddress)
            .getRewards(archaeologists[0].archAddress);

          expect(cursedArch.cursedBond).to.eq(newCursedBond);
          expect(rewards).to.eq(diggingFeeAmount.add(archaeologist.curseFee));
        });
      });
    });

    describe("unwrapSarcophagus", () => {
      context("with cursedBondPercentage set to 150", () => {
        beforeEach(async () => {
          const { adminFacet } = await getContracts();
          await adminFacet.connect(deployer).setCursedBondPercentage(150);
        });

        it("pays the correct amount of rewards and releases the cursed bond when a sarcophagus has been rewrapped", async () => {
          const { archaeologistFacet, viewStateFacet, embalmerFacet } =
            await getContracts();
          const {
            createdSarcophagusData: sarcophagusData,
            cursedArchaeologists: archaeologists,
          } = await createSarcophagusWithRegisteredCursedArchaeologists();

          const archaeologist = await viewStateFacet.getArchaeologistProfile(
            archaeologists[0].archAddress
          );

          const diggingFeeAmountFirstInterval = BigNumber.from(
            sarcophagusData.resurrectionTimeSeconds -
              sarcophagusData.creationTimeSeconds
          ).mul(archaeologist.minimumDiggingFeePerSecond);

          // rewrap sarcophagus to force payout of curse fee
          await embalmerFacet
            .connect(sarcophagusData.embalmer)
            .rewrapSarcophagus(
              sarcophagusData.sarcoId,
              (await time.latest()) + 10000
            );

          const sarco = await viewStateFacet.getSarcophagus(
            sarcophagusData.sarcoId
          );

          const diggingFeeAmountSecondInterval = BigNumber.from(
            sarco.resurrectionTime.sub(sarco.previousRewrapTime)
          ).mul(archaeologist.minimumDiggingFeePerSecond);

          await time.increaseTo(sarco.resurrectionTime.toNumber());

          await archaeologistFacet
            .connect(await ethers.getSigner(archaeologists[0].archAddress))
            .publishPrivateKey(
              sarcophagusData.sarcoId,
              archaeologists[0].privateKey
            );

          const rewards = await viewStateFacet
            .connect(archaeologists[0].archAddress)
            .getRewards(archaeologists[0].archAddress);

          const updatedArchaeologist =
            await viewStateFacet.getArchaeologistProfile(
              archaeologists[0].archAddress
            );

          expect(rewards).to.eq(
            diggingFeeAmountFirstInterval
              .add(archaeologist.curseFee)
              .add(diggingFeeAmountSecondInterval)
          );

          // All of the archaeologist's bond should be freed
          expect(updatedArchaeologist.freeBond).to.eq(
            archaeologist.freeBond.add(archaeologist.cursedBond)
          );
          expect(updatedArchaeologist.cursedBond).to.eq(BigNumber.from(0));
        });

        it("pays the correct amount of rewards and releases the cursed bond when a sarcophagus has *not* been rewrapped", async () => {
          const { archaeologistFacet, viewStateFacet } = await getContracts();
          const {
            createdSarcophagusData: sarcophagusData,
            cursedArchaeologists: archaeologists,
          } = await createSarcophagusWithRegisteredCursedArchaeologists();

          const archaeologist = await viewStateFacet.getArchaeologistProfile(
            archaeologists[0].archAddress
          );

          const diggingFeeAmount = BigNumber.from(
            sarcophagusData.resurrectionTimeSeconds -
              sarcophagusData.creationTimeSeconds
          ).mul(archaeologist.minimumDiggingFeePerSecond);

          await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);

          await archaeologistFacet
            .connect(await ethers.getSigner(archaeologists[0].archAddress))
            .publishPrivateKey(
              sarcophagusData.sarcoId,
              archaeologists[0].privateKey
            );

          const rewards = await viewStateFacet
            .connect(archaeologists[0].archAddress)
            .getRewards(archaeologists[0].archAddress);

          const updatedArchaeologist =
            await viewStateFacet.getArchaeologistProfile(
              archaeologists[0].archAddress
            );

          expect(rewards).to.eq(diggingFeeAmount.add(archaeologist.curseFee));

          // All of the archaeologist's bond should be freed
          expect(updatedArchaeologist.freeBond).to.eq(
            archaeologist.freeBond.add(archaeologist.cursedBond)
          );
          expect(updatedArchaeologist.cursedBond).to.eq(BigNumber.from(0));
        });
      });
    });
  });
});
