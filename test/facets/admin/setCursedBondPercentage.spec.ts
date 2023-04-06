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

const { deployments, ethers } = require("hardhat");

describe("AdminFacet.setCursedBondPercentage", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => {
    await deployments.fixture();
    accountGenerator.index = 0;
  });

  it("defaults the cursedBondPercentage to 100", async () => {
    const { viewStateFacet } = await getContracts();
    const signers = await ethers.getSigners();

    const cursedBondPercentage = await viewStateFacet
      .connect(signers[0])
      .getCursedBondPercentage();
    expect(cursedBondPercentage).to.eq(100);
  });

  it("sets the cursed bond percentage if caller is owner", async () => {
    const { adminFacet, viewStateFacet } = await getContracts();
    const deployer = await ethers.getNamedSigner("deployer");
    await adminFacet.connect(deployer).setCursedBondPercentage(200);

    const cursedBondPercentage = await viewStateFacet
      .connect(deployer)
      .getCursedBondPercentage();
    expect(cursedBondPercentage).to.eq(200);
  });

  it("emits SetCursedBondPercentage", async () => {
    const { adminFacet } = await getContracts();
    const deployer = await ethers.getNamedSigner("deployer");
    const tx = adminFacet.connect(deployer).setCursedBondPercentage(200);
    // @ts-ignore
    await expect(tx).to.emit(adminFacet, `SetCursedBondPercentage`);
  });

  it("reverts when a non-owner is the caller", async () => {
    const { adminFacet } = await getContracts();
    const signers = await ethers.getSigners();
    const tx = adminFacet.connect(signers[1]).setCursedBondPercentage(200);

    // @ts-ignore
    await expect(tx).to.be.reverted;
  });

  describe("createSarcophagus", () => {
    context("with cursedBondPercentage set to 150", () => {
      beforeEach(async () => {
        const { adminFacet } = await getContracts();
        const deployer = await ethers.getNamedSigner("deployer");
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

        const diggingFeeAmount = BigNumber.from(
          sarcophagusData.resurrectionTimeSeconds -
            sarcophagusData.creationTimeSeconds
        ).mul(archaeologist.minimumDiggingFeePerSecond);

        // Cursed bond should be 1.5x the digging fee
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
        const deployer = await ethers.getNamedSigner("deployer");
        await adminFacet.connect(deployer).setCursedBondPercentage(150);
      });

      it("pays the correct amount of rewards", async () => {
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

        const rewrapTime =
          sarcophagusData.resurrectionTimeSeconds -
          sarcophagusData.creationTimeSeconds;

        const diggingFeeAmount = BigNumber.from(rewrapTime).mul(
          archaeologist.minimumDiggingFeePerSecond
        );

        await embalmerFacet
          .connect(sarcophagusData.embalmer)
          .rewrapSarcophagus(
            sarcophagusData.sarcoId,
            (await time.latest()) + 10000
          );

        const rewards = await viewStateFacet
          .connect(archaeologists[0].archAddress)
          .getRewards(archaeologists[0].archAddress);

        expect(rewards).to.eq(diggingFeeAmount);
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

      it("locks up the correct amount of bond from the digging fees", async () => {
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

        const minDiggingFeePerSecond = archaeologist.minimumDiggingFeePerSecond;

        const initialResurrectionInterval =
          sarcophagusData.resurrectionTimeSeconds -
          sarcophagusData.creationTimeSeconds;

        const diggingFeeAmount = BigNumber.from(
          initialResurrectionInterval
        ).mul(minDiggingFeePerSecond);
        const originalCursedBond = diggingFeeAmount.mul(150).div(100);

        await embalmerFacet
          .connect(sarcophagusData.embalmer)
          .rewrapSarcophagus(
            sarcophagusData.sarcoId,
            (await time.latest()) + 15000
          );

        const updatedArch = await viewStateFacet.getArchaeologistProfile(
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

        expect(updatedArch.cursedBond).to.eq(newCursedBond);
        expect(rewards).to.eq(newRewards);
      });
    });
  });

  describe("unwrapSarcophagus", () => {
    context("with cursedBondPercentage set to 150", () => {
      beforeEach(async () => {
        const { adminFacet } = await getContracts();
        const deployer = await ethers.getNamedSigner("deployer");
        await adminFacet.connect(deployer).setCursedBondPercentage(150);
      });

      it("pays the correct amount of rewards and releases the cursed bond", async () => {
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

        expect(rewards).to.eq(diggingFeeAmount);
        expect(updatedArchaeologist.freeBond).to.eq(
          archaeologist.freeBond.add(archaeologist.cursedBond)
        );
        expect(updatedArchaeologist.cursedBond).to.eq(BigNumber.from(0));
      });
    });
  });
});
