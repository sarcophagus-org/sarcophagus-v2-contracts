import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import { generateSarcophagusWithArchaeologists } from "../helpers/sarcophagus";
import time from "../../utils/time";
import { getContracts } from "../helpers/contracts";
import { getFreshAccount } from "../helpers/accounts";
import { hashShare } from "../helpers/shamirSecretSharing";
import { BigNumber } from "ethers";
import { getSarquitoBalance } from "../helpers/sarcoToken";
import { ArchaeologistData } from "../helpers/archaeologist";
import { verifyAccusalStatusesForArchaeologists } from "../helpers/accuse";

const { deployments, ethers } = require("hardhat");

describe("accuse v2", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("Validates accusal parameters", function () {
    it("Should revert on a nonexistent sarcophagus ID", async function () {
      const accuser = await getFreshAccount();

      // generate a nonexistent sarcoId
      const name = "does not exist";
      const sarcoId = ethers.utils.solidityKeccak256(["string"], [name]);

      // run accuse on a nonexistent sarcophagus
      const tx = (await getContracts()).thirdPartyFacet
        .connect(accuser)
        .accuse(sarcoId, [], accuser.address);

      await expect(tx).to.be.revertedWith(
        `SarcophagusDoesNotExist("${sarcoId}")`
      );
    });

    it("Should revert if the current time is past the resurrectionTime", async function () {
      // generate a sarcophagus with a resurrection time 1 week in the future
      const resurrectionTimeSeconds =
        (await time.latest()) + time.duration.weeks(1);
      const { embalmer, sarcophagus } =
        await generateSarcophagusWithArchaeologists({
          totalShares: 5,
          threshold: 3,
          maximumRewrapIntervalSeconds: time.duration.weeks(4),
          resurrectionTimeSeconds:
            (await time.latest()) + time.duration.weeks(1),
        });

      // set the current time to one week in the future, after the sarcophagus is allowed to be resurrected
      await time.increaseTo(resurrectionTimeSeconds);

      // accuse an archaeologist of leaking a keyshare
      const tx = (await getContracts()).thirdPartyFacet
        .connect(embalmer)
        .accuse(sarcophagus.sarcoId, [], embalmer.address);

      await expect(tx).to.be.revertedWith(`SarcophagusIsUnwrappable()`);
    });
  });

  describe("Supports accusal of fewer than k archaeologists", function () {
    it("breads On a successful accusal of an archaeologist, should transfer the correct amount of funds to embalmer and accuser, slash the archaeologist's bond, mark the arch as accused, and emit an AccuseArchaeologist event", async function () {
      const { thirdPartyFacet, viewStateFacet } = await getContracts();
      const accuser = await getFreshAccount();
      const { embalmer, sarcophagus, archaeologists } =
        await generateSarcophagusWithArchaeologists({
          totalShares: 5,
          threshold: 3,
          maximumRewrapIntervalSeconds: time.duration.weeks(4),
          resurrectionTimeSeconds:
            (await time.latest()) + time.duration.weeks(3),
        });
      const accusedArchaeologist = archaeologists[0];

      // save the sarquito balance of the embalmer prior to the accusal
      const embalmerPreAccuseSarquitoBalance = await getSarquitoBalance(
        embalmer.address
      );
      // save accused archaeologist initial free bond
      const accusedArchaeologistInitialFreeBondSarquitos = (
        await viewStateFacet.getArchaeologistProfile(
          accusedArchaeologist.archAddress
        )
      ).freeBond;

      // accuse the archaeologist of leaking a keyshare
      const tx = thirdPartyFacet
        .connect(accuser)
        .accuse(
          sarcophagus.sarcoId,
          [hashShare(accusedArchaeologist.rawKeyShare)],
          accuser.address
        );

      // verify that AccuseArchaeologist is emitted
      await expect(tx).to.emit(thirdPartyFacet, `AccuseArchaeologist`);

      // verify that the accuser receives half of archaeologist cursed bond (equal to digging fee)
      expect(await getSarquitoBalance(accuser.address)).to.equal(
        BigNumber.from(accusedArchaeologist.diggingFee).div(2).toString()
      );

      const embalmerPostAccuseSarquitoBalance = await getSarquitoBalance(
        embalmer.address
      );
      // verify embalmer receives half of archaeologist cursed bond plus full digging fee
      expect(
        embalmerPostAccuseSarquitoBalance
          .sub(embalmerPreAccuseSarquitoBalance)
          .toString()
      ).to.equal(
        BigNumber.from(accusedArchaeologist.diggingFee)
          .div(2)
          .add(BigNumber.from(accusedArchaeologist.diggingFee))
          .toString()
      );

      const accusedArchaeologistProfile =
        await viewStateFacet.getArchaeologistProfile(
          accusedArchaeologist.archAddress
        );

      // verify accused archaeologist cursed bond has been set to 0
      expect(accusedArchaeologistProfile.cursedBond.toString()).to.equal("0");
      expect(accusedArchaeologistProfile.freeBond.toString()).to.equal(
        accusedArchaeologistInitialFreeBondSarquitos.toString()
      );

      // verify accused archaeologist has been marked as accused
      const accusedArchaeologistStorage =
        await viewStateFacet.getSarcophagusArchaeologist(
          sarcophagus.sarcoId,
          accusedArchaeologist.archAddress
        );
      expect(accusedArchaeologistStorage.isAccused).to.be.true;

      // verify the sarcoId has been added to the accused archaeologist's archaeologistAccusals
      const accusedArchaeologistAccusalsCount =
        await viewStateFacet.getArchaeologistAccusalsCount(
          accusedArchaeologist.archAddress
        );
      expect(accusedArchaeologistAccusalsCount.toString()).to.equal("1");
    });

    it("Should not refund bonds to other archaeologists or change sarcophagus state if less than k archaeologists have been accused", async function () {
      const accuser = await getFreshAccount();
      const { viewStateFacet } = await getContracts();

      const { sarcophagus, archaeologists } =
        await generateSarcophagusWithArchaeologists({
          totalShares: 5,
          threshold: 3,
          maximumRewrapIntervalSeconds: time.duration.weeks(4),
          resurrectionTimeSeconds:
            (await time.latest()) + time.duration.weeks(3),
        });

      const accusedArchaeologist = archaeologists[0];
      // hash the leaked keyshare
      const hashedShare = hashShare(accusedArchaeologist.rawKeyShare);

      // accuse an archaeologist of leaking a keyshare
      await (await getContracts()).thirdPartyFacet
        .connect(accuser)
        .accuse(sarcophagus.sarcoId, [hashedShare], accuser.address);

      // verify the sarcophagus state is still active
      // expect(
      //   (await viewStateFacet.getSarcophagus(sarcophagus.sarcoId)).state
      // ).to.equal(SarcophagusState.Active);

      // verify the remaining 4 archaeologists still have their bonds locked
      await Promise.all(
        archaeologists.slice(1).map(async (innocentArchaeologist) => {
          const innocentArchaeologistProfile =
            await viewStateFacet.getArchaeologistProfile(
              innocentArchaeologist.archAddress
            );
          expect(innocentArchaeologistProfile.cursedBond.toString()).to.equal(
            innocentArchaeologist.diggingFee
          );
        })
      );
    });
    it("Should not pay out digging fees or cursed bond or emit an event on accusal of an archaeologist that has already been accused once", async function () {
      const { thirdPartyFacet, viewStateFacet } = await getContracts();
      const accuser = await getFreshAccount();
      const { embalmer, sarcophagus, archaeologists } =
        await generateSarcophagusWithArchaeologists({
          totalShares: 5,
          threshold: 3,
          maximumRewrapIntervalSeconds: time.duration.weeks(4),
          resurrectionTimeSeconds:
            (await time.latest()) + time.duration.weeks(3),
        });
      const accusedArchaeologist = archaeologists[0];
      const embalmerPreAccuseSarquitoBalance = await getSarquitoBalance(
        embalmer.address
      );
      // save accused archaeologist initial free bond
      const accusedArchaeologistInitialFreeBondSarquitos = (
        await viewStateFacet.getArchaeologistProfile(
          accusedArchaeologist.archAddress
        )
      ).freeBond;
      // accuse the archaeologist of leaking a keyshare
      await thirdPartyFacet
        .connect(accuser)
        .accuse(
          sarcophagus.sarcoId,
          [hashShare(accusedArchaeologist.rawKeyShare)],
          accuser.address
        );

      // verify accuser and embalmer have received the expected funds
      expect(await getSarquitoBalance(accuser.address)).to.equal(
        BigNumber.from(accusedArchaeologist.diggingFee).div(2).toString()
      );

      expect(await getSarquitoBalance(embalmer.address)).to.equal(
        BigNumber.from(accusedArchaeologist.diggingFee)
          .div(2)
          .add(BigNumber.from(accusedArchaeologist.diggingFee))
          .add(embalmerPreAccuseSarquitoBalance)
          .toString()
      );

      // save the sarquito balance of the embalmer and the accuser after the first accusal
      const embalmerPostAccuseSarquitoBalance = await getSarquitoBalance(
        embalmer.address
      );
      const accuserPostAccuseSarquitoBalance = await getSarquitoBalance(
        accuser.address
      );

      // accuse the same archaeologist a second time
      const tx = thirdPartyFacet
        .connect(accuser)
        .accuse(
          sarcophagus.sarcoId,
          [hashShare(accusedArchaeologist.rawKeyShare)],
          accuser.address
        );

      // verify that AccuseArchaeologist is not emitted
      await expect(tx).not.to.emit(thirdPartyFacet, `AccuseArchaeologist`);

      // verify that the accuser balance is unchanged
      expect(await getSarquitoBalance(accuser.address)).to.equal(
        accuserPostAccuseSarquitoBalance.toString()
      );

      // verify that the embalmer balance is unchanged
      expect(await getSarquitoBalance(embalmer.address)).to.equal(
        embalmerPostAccuseSarquitoBalance.toString()
      );

      // verify accused archaeologist cursed bond has been set to 0 and free bond has not been increased
      const accusedArchaeologistProfile =
        await viewStateFacet.getArchaeologistProfile(
          accusedArchaeologist.archAddress
        );
      expect(accusedArchaeologistProfile.cursedBond.toString()).to.equal("0");
      expect(accusedArchaeologistProfile.freeBond.toString()).to.equal(
        accusedArchaeologistInitialFreeBondSarquitos.toString()
      );

      // verify accused archaeologist has been marked as accused
      const accusedArchaeologistStorage =
        await viewStateFacet.getSarcophagusArchaeologist(
          sarcophagus.sarcoId,
          accusedArchaeologist.archAddress
        );
      expect(accusedArchaeologistStorage.isAccused).to.be.true;

      // verify the sarcoId has only been added to the accused archaeologist's archaeologistAccusals once
      const accusedArchaeologistAccusalsCount =
        await viewStateFacet.getArchaeologistAccusalsCount(
          accusedArchaeologist.archAddress
        );
      expect(accusedArchaeologistAccusalsCount.toString()).to.equal("1");
    });
  });

  describe("Supports accusal of k or more archaeologists", function () {
    it("On a successful accusal of 3 archaeologists on a 3 of 5 sarco, should split cursed bond for the 3 leaking archs between the embalmer and the accuser, refund digging fees for 3 archaeologists to the embalmer, slash the 3 leaking archaeologists' bonds, mark the archaeologists as accused, and emit an AccuseArchaeologist event", async function () {
      const { thirdPartyFacet, viewStateFacet } = await getContracts();
      const accuser = await getFreshAccount();
      const { embalmer, sarcophagus, archaeologists } =
        await generateSarcophagusWithArchaeologists({
          totalShares: 5,
          threshold: 3,
          maximumRewrapIntervalSeconds: time.duration.weeks(4),
          resurrectionTimeSeconds:
            (await time.latest()) + time.duration.weeks(3),
        });
      const accusedArchaeologists = archaeologists.slice(0, 3);
      const innocentArchaeologists = archaeologists.slice(3, 5);

      // snapshot the balance of the embalmer prior to the accusal
      const embalmerPreAccuseSarquitoBalance = await getSarquitoBalance(
        embalmer.address
      );

      // snapshot all archaeologist free bond values prior to accusal
      const archaeologistAddressesToInitialFreeBondsSarquitos: Map<
        string,
        BigNumber
      > = new Map();
      (
        await viewStateFacet.getArchaeologistProfiles(
          archaeologists.map((archaeologist) => archaeologist.archAddress)
        )
      ).forEach((archaeologistProfile, index) =>
        archaeologistAddressesToInitialFreeBondsSarquitos.set(
          archaeologists[index].archAddress,
          archaeologistProfile.freeBond
        )
      );

      // accuse the archaeologist of leaking a keyshare
      const tx = thirdPartyFacet.connect(accuser).accuse(
        sarcophagus.sarcoId,
        accusedArchaeologists.map((accusedArchaeologist) =>
          hashShare(accusedArchaeologist.rawKeyShare)
        ),
        accuser.address
      );

      // verify that AccuseArchaeologist is emitted
      await expect(tx).to.emit(thirdPartyFacet, `AccuseArchaeologist`);

      const combinedDiggingFeesSarquito: BigNumber =
        accusedArchaeologists.reduce(
          (sum: BigNumber, accusedArchaeologist: ArchaeologistData) =>
            sum.add(BigNumber.from(accusedArchaeologist.diggingFee)),
          BigNumber.from(0)
        );
      // verify that the accuser receives half of archaeologist cursed bond (equal to digging fee)
      expect(await getSarquitoBalance(accuser.address)).to.equal(
        BigNumber.from(combinedDiggingFeesSarquito).div(2).toString()
      );

      const embalmerPostAccuseSarquitoBalance = await getSarquitoBalance(
        embalmer.address
      );
      // verify embalmer receives half of archaeologist cursed bond plus full digging fee
      expect(
        embalmerPostAccuseSarquitoBalance
          .sub(embalmerPreAccuseSarquitoBalance)
          .toString()
      ).to.equal(
        BigNumber.from(combinedDiggingFeesSarquito)
          .div(2)
          // todo: refund digging fees for freed archaeologists too?
          .add(combinedDiggingFeesSarquito)
          .toString()
      );

      const accusedArchaeologistProfiles =
        await viewStateFacet.getArchaeologistProfiles(
          accusedArchaeologists.map(
            (accusedArchaeologist) => accusedArchaeologist.archAddress
          )
        );
      const innocentArchaeologistProfiles =
        await viewStateFacet.getArchaeologistProfiles(
          innocentArchaeologists.map(
            (innocentArchaeologist) => innocentArchaeologist.archAddress
          )
        );
      // verify accused archaeologists cursed bonds have zeroed and free bonds haven't been increased
      accusedArchaeologistProfiles.forEach(
        (accusedArchaeologistProfile, index) => {
          expect(accusedArchaeologistProfile.cursedBond.toString()).to.equal(
            "0"
          );
          // archaeologist's free bond prior to accusal
          const initialFreeBond =
            archaeologistAddressesToInitialFreeBondsSarquitos.get(
              accusedArchaeologists[index].archAddress
            );
          expect(accusedArchaeologistProfile.freeBond.toString()).to.equal(
            initialFreeBond
          );
        }
      );

      // verify innocent archaeologist bond has been freed - cursed bond set to zero and free bond increased by digging fee (cursed bond amount)
      innocentArchaeologistProfiles.forEach(
        (innocentArchaeologistProfile, index) => {
          expect(innocentArchaeologistProfile.cursedBond.toString()).to.equal(
            "0"
          );
          // archaeologist's free bond prior to accusal
          const initialFreeBond =
            archaeologistAddressesToInitialFreeBondsSarquitos.get(
              innocentArchaeologists[index].archAddress
            );
          expect(innocentArchaeologistProfile.freeBond.toString()).to.equal(
            initialFreeBond!.add(innocentArchaeologists[index].diggingFee)
          );
        }
      );

      // verify accused archaeologists have been marked as accused
      await verifyAccusalStatusesForArchaeologists(
        sarcophagus.sarcoId,
        accusedArchaeologists,
        true
      );

      // verify innocent archaeologists have not been marked as accused
      await verifyAccusalStatusesForArchaeologists(
        sarcophagus.sarcoId,
        innocentArchaeologists,
        false
      );

      // verify the sarcoId has been added to the accused archaeologist's archaeologistAccusals
      await Promise.all(
        accusedArchaeologists.map(async (accusedArchaeologist) => {
          const accusedArchaeologistAccusalsCount =
            await viewStateFacet.getArchaeologistAccusalsCount(
              accusedArchaeologist.archAddress
            );
          expect(accusedArchaeologistAccusalsCount.toString()).to.equal("1");
        })
      );

      // verify the sarcoId has not been added to the innocent archaeologist's archaeologistAccusals
      await Promise.all(
        innocentArchaeologists.map(async (innocentArchaeologist) => {
          const innocentArchaeologistAccusalsCount =
            await viewStateFacet.getArchaeologistAccusalsCount(
              innocentArchaeologist.archAddress
            );
          expect(innocentArchaeologistAccusalsCount.toString()).to.equal("0");
        })
      );
    });

    it("Should allow accusal of 2 archaeologists on a 3 of 5 sarcophagus without freeing all other archaeologists", async function () {
      const accuser = await getFreshAccount();
      const { viewStateFacet } = await getContracts();

      const { sarcophagus, archaeologists } =
        await generateSarcophagusWithArchaeologists({
          totalShares: 5,
          threshold: 3,
          maximumRewrapIntervalSeconds: time.duration.weeks(4),
          resurrectionTimeSeconds:
            (await time.latest()) + time.duration.weeks(3),
        });

      const accusedArchaeologists = archaeologists.splice(0, 2);

      // accuse an archaeologist of leaking a keyshare
      await (await getContracts()).thirdPartyFacet.connect(accuser).accuse(
        sarcophagus.sarcoId,
        accusedArchaeologists.map((accusedArchaeologist) =>
          hashShare(accusedArchaeologist.rawKeyShare)
        ),
        accuser.address
      );

      // verify the sarcophagus state is still active
      // expect(
      //   (await viewStateFacet.getSarcophagus(sarcophagus.sarcoId)).state
      // ).to.equal(SarcophagusState.Active);

      // verify the remaining 4 archaeologists still have their bonds locked
      await Promise.all(
        archaeologists.slice(1).map(async (innocentArchaeologist) => {
          const innocentArchaeologistProfile =
            await viewStateFacet.getArchaeologistProfile(
              innocentArchaeologist.archAddress
            );
          expect(innocentArchaeologistProfile.cursedBond.toString()).to.equal(
            innocentArchaeologist.diggingFee
          );
        })
      );
    });

    it("Should free all unaccused archaeologists upon successful accusal of 1 archaeologist on a 3 of 5 sarcophagus where 2 have been accused on a previous call and update state to accused", async function () {
      const { thirdPartyFacet, viewStateFacet } = await getContracts();
      const accuser = await getFreshAccount();
      const { embalmer, sarcophagus, archaeologists } =
        await generateSarcophagusWithArchaeologists({
          totalShares: 5,
          threshold: 3,
          maximumRewrapIntervalSeconds: time.duration.weeks(4),
          resurrectionTimeSeconds:
            (await time.latest()) + time.duration.weeks(3),
        });
      const accusedArchaeologists = archaeologists.slice(0, 3);
      const innocentArchaeologists = archaeologists.slice(3, 5);

      // snapshot the balance of the embalmer prior to the accusal
      const embalmerPreAccuseSarquitoBalance = await getSarquitoBalance(
        embalmer.address
      );

      // snapshot all archaeologist free bond values prior to accusal
      const archaeologistAddressesToInitialFreeBondsSarquitos: Map<
        string,
        BigNumber
      > = new Map();
      (
        await viewStateFacet.getArchaeologistProfiles(
          archaeologists.map((archaeologist) => archaeologist.archAddress)
        )
      ).forEach((archaeologistProfile, index) =>
        archaeologistAddressesToInitialFreeBondsSarquitos.set(
          archaeologists[index].archAddress,
          archaeologistProfile.freeBond
        )
      );

      // accuse two archaeologists of leaking a keyshare
      const tx1 = thirdPartyFacet.connect(accuser).accuse(
        sarcophagus.sarcoId,
        accusedArchaeologists
          .slice(0, 2)
          .map((accusedArchaeologist) =>
            hashShare(accusedArchaeologist.rawKeyShare)
          ),
        accuser.address
      );

      // verify that AccuseArchaeologist is emitted
      await expect(tx1).to.emit(thirdPartyFacet, `AccuseArchaeologist`);

      // accuse one more archaeologist of leaking a keyshare
      const tx2 = thirdPartyFacet.connect(accuser).accuse(
        sarcophagus.sarcoId,
        accusedArchaeologists
          .slice(2, 3)
          .map((accusedArchaeologist) =>
            hashShare(accusedArchaeologist.rawKeyShare)
          ),
        accuser.address
      );

      // verify that AccuseArchaeologist is emitted
      await expect(tx2).to.emit(thirdPartyFacet, `AccuseArchaeologist`);

      const combinedDiggingFeesSarquito: BigNumber =
        accusedArchaeologists.reduce(
          (sum: BigNumber, accusedArchaeologist: ArchaeologistData) =>
            sum.add(BigNumber.from(accusedArchaeologist.diggingFee)),
          BigNumber.from(0)
        );
      // verify that the accuser receives half of archaeologist cursed bond (equal to digging fee)
      expect(await getSarquitoBalance(accuser.address)).to.equal(
        BigNumber.from(combinedDiggingFeesSarquito).div(2).toString()
      );

      const embalmerPostAccuseSarquitoBalance = await getSarquitoBalance(
        embalmer.address
      );
      // verify embalmer receives half of archaeologist cursed bond plus full digging fee
      expect(
        embalmerPostAccuseSarquitoBalance
          .sub(embalmerPreAccuseSarquitoBalance)
          .toString()
      ).to.equal(
        BigNumber.from(combinedDiggingFeesSarquito)
          .div(2)
          // todo: refund digging fees for freed archaeologists too?
          .add(combinedDiggingFeesSarquito)
          .toString()
      );

      const accusedArchaeologistProfiles =
        await viewStateFacet.getArchaeologistProfiles(
          accusedArchaeologists.map(
            (accusedArchaeologist) => accusedArchaeologist.archAddress
          )
        );
      const innocentArchaeologistProfiles =
        await viewStateFacet.getArchaeologistProfiles(
          innocentArchaeologists.map(
            (innocentArchaeologist) => innocentArchaeologist.archAddress
          )
        );
      // verify accused archaeologists cursed bonds have zeroed and free bonds haven't been increased
      accusedArchaeologistProfiles.forEach(
        (accusedArchaeologistProfile, index) => {
          expect(accusedArchaeologistProfile.cursedBond.toString()).to.equal(
            "0"
          );
          // archaeologist's free bond prior to accusal
          const initialFreeBond =
            archaeologistAddressesToInitialFreeBondsSarquitos.get(
              accusedArchaeologists[index].archAddress
            );
          expect(accusedArchaeologistProfile.freeBond.toString()).to.equal(
            initialFreeBond
          );
        }
      );

      // verify innocent archaeologist bond has been freed - cursed bond set to zero and free bond increased by digging fee (cursed bond amount)
      innocentArchaeologistProfiles.forEach(
        (innocentArchaeologistProfile, index) => {
          expect(innocentArchaeologistProfile.cursedBond.toString()).to.equal(
            "0"
          );
          // archaeologist's free bond prior to accusal
          const initialFreeBond =
            archaeologistAddressesToInitialFreeBondsSarquitos.get(
              innocentArchaeologists[index].archAddress
            );
          expect(innocentArchaeologistProfile.freeBond.toString()).to.equal(
            initialFreeBond!.add(innocentArchaeologists[index].diggingFee)
          );
        }
      );

      // verify accused archaeologists have been marked as accused
      await verifyAccusalStatusesForArchaeologists(
        sarcophagus.sarcoId,
        accusedArchaeologists,
        true
      );

      // verify innocent archaeologists have not been marked as accused
      await verifyAccusalStatusesForArchaeologists(
        sarcophagus.sarcoId,
        innocentArchaeologists,
        false
      );

      // verify the sarcoId has been added to the accused archaeologist's archaeologistAccusals
      await Promise.all(
        accusedArchaeologists.map(async (accusedArchaeologist) => {
          const accusedArchaeologistAccusalsCount =
            await viewStateFacet.getArchaeologistAccusalsCount(
              accusedArchaeologist.archAddress
            );
          expect(accusedArchaeologistAccusalsCount.toString()).to.equal("1");
        })
      );

      // verify the sarcoId has not been added to the innocent archaeologist's archaeologistAccusals
      await Promise.all(
        innocentArchaeologists.map(async (innocentArchaeologist) => {
          const innocentArchaeologistAccusalsCount =
            await viewStateFacet.getArchaeologistAccusalsCount(
              innocentArchaeologist.archAddress
            );
          expect(innocentArchaeologistAccusalsCount.toString()).to.equal("0");
        })
      );
    });
  });
});
