import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import time from "../utils/time";
import { calculateCursedBond } from "../utils/helpers";
import { createSarcoFixture } from "../fixtures/create-sarco-fixture";
import { BigNumber } from "ethers";
import { formatBytes32String } from "ethers/lib/utils";
import { hashBytes } from "../fixtures/spawn-archaeologists";
import { SarcophagusState } from "../types";

describe("Contract: ThirdPartyFacet", () => {
  const shares = 5;
  const threshold = 3;

  describe("clean()", () => {
    context("When successful", () => {
      it("Should distribute sum of cursed bonds of bad-acting archaeologists to embalmer and the address specified by cleaner", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          sarcoToken,
          embalmer,
          thirdParty,
          thirdPartyFacet,
          viewStateFacet,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Increase time to when sarco can be unwrapped
        await time.increaseTo(resurrectionTime);

        const unaccusedArchaeologist = archaeologists[0];

        // unaccusedArchaeologist will fulfil their duty
        await archaeologistFacet
          .connect(unaccusedArchaeologist.signer)
          .unwrapSarcophagus(sarcoId, unaccusedArchaeologist.unencryptedShard);

        // increase time beyond grace period to expire sarcophagus
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increase(+gracePeriod + 1);

        const embalmerBalanceBefore = await sarcoToken.balanceOf(embalmer.address);
        const paymentAccountBalanceBefore = await sarcoToken.balanceOf(thirdParty.address);

        // before cleaning...
        expect(paymentAccountBalanceBefore).to.eq(0);

        await thirdPartyFacet.connect(thirdParty).clean(sarcoId, thirdParty.address);

        const embalmerBalanceAfter = await sarcoToken.balanceOf(embalmer.address);
        const paymentAccountBalanceAfter = await sarcoToken.balanceOf(thirdParty.address);

        // after cleaning, calculate sum, and verify on exact amounts instead
        // Set up amounts that should have been transferred to accuser and embalmer
        // ie, rewards of failed archaeologists
        const sumDiggingFees = archaeologists
          .slice(1) // archaeologists[0] did their job, so not included
          .reduce((acc, arch) => [acc[0].add(arch.diggingFee)], [BigNumber.from("0")]);

        const totalDiggingFees = sumDiggingFees[0];

        const cursedBond = calculateCursedBond(totalDiggingFees);
        const toEmbalmer = cursedBond.div(2);
        const toCleaner = cursedBond.sub(toEmbalmer);

        // Check that embalmer and accuser now have balance that includes the amount that should have been transferred to them

        // embalmer should receive half cursed bond, PLUS digging fees of failed archs
        const embalmerReward = toEmbalmer.add(totalDiggingFees);

        expect(embalmerBalanceAfter.eq(embalmerBalanceBefore.add(embalmerReward))).to.be.true;
        expect(paymentAccountBalanceAfter.eq(paymentAccountBalanceBefore.add(toCleaner))).to.be
          .true;
      });

      it("Should reduce cursed bonds on storage of archaeologists after distributing their value, without increasing free bond of bad-acting ones", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          thirdParty,
          thirdPartyFacet,
          viewStateFacet,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Cursed and free bonds before cleaning:
        const cursedBondsBefore: BigNumber[] = [];
        const freeBondsBefore: BigNumber[] = [];

        for await (const arch of archaeologists) {
          cursedBondsBefore.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsBefore.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        // Increase time to when sarco can be unwrapped
        await time.increaseTo(resurrectionTime);

        // Have one arch actually do the unwrapping
        const unaccusedArchaeologist = archaeologists[0];
        await archaeologistFacet
          .connect(unaccusedArchaeologist.signer)
          .unwrapSarcophagus(sarcoId, unaccusedArchaeologist.unencryptedShard);

        // increase time beyond grace period to expire sarcophagus
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increase(+gracePeriod + 1);

        await thirdPartyFacet.connect(thirdParty).clean(sarcoId, thirdParty.address);

        // Cursed and free bonds after cleaning:
        const cursedBondsAfter: BigNumber[] = [];
        const freeBondsAfter: BigNumber[] = [];

        for await (const arch of archaeologists) {
          cursedBondsAfter.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsAfter.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        // Check that good archaeologist's free bonds have been increased
        expect(freeBondsBefore[0].lt(freeBondsAfter[0])).to.be.true;

        for (let i = 0; i < cursedBondsBefore.length; i++) {
          // Check that all archaeologists' cursed bonds have been reduced
          expect(cursedBondsBefore[i].gt(cursedBondsAfter[i])).to.be.true;

          if (i !== 0) {
            // Check that accused archaeologist's free bonds have NOT been increased
            expect(freeBondsBefore[i].eq(freeBondsAfter[i])).to.be.true;
          }
        }
      });

      it("Should emit CleanUpSarcophagus on successful cleanup", async () => {
        const { sarcoId, thirdParty, thirdPartyFacet, viewStateFacet, resurrectionTime } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // increase time beyond resurrection time + grace period to expire sarcophagus
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increaseTo(resurrectionTime + +gracePeriod + 1);

        const tx = thirdPartyFacet.connect(thirdParty).clean(sarcoId, thirdParty.address);

        await expect(tx).to.emit(thirdPartyFacet, "CleanUpSarcophagus");
      });

      it("Should increment count for all defaulting archaeologists to archaeologistCleanups storage on successful cleanup", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          thirdParty,
          thirdPartyFacet,
          viewStateFacet,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const unaccusedArchaeologist = archaeologists[0];

        // Have one arch actually do the unwrapping
        await time.increaseTo(resurrectionTime);
        await archaeologistFacet
          .connect(unaccusedArchaeologist.signer)
          .unwrapSarcophagus(sarcoId, unaccusedArchaeologist.unencryptedShard);

        // increase time beyond grace period to expire sarcophagus
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increase(+gracePeriod + 1);

        // Get the clean up count of each archaeologist before cleaning
        const cleanupsBefore: BigNumber[] = [];
        for (const arch of archaeologists) {
          cleanupsBefore.push(await viewStateFacet.getArchaeologistCleanupsCount(arch.archAddress));
        }

        // Clean the sarcophagus
        await thirdPartyFacet.connect(thirdParty).clean(sarcoId, thirdParty.address);

        // Get the clean up count of each archaeologist after cleaning
        const cleanupsAfter: BigNumber[] = [];
        for (const arch of archaeologists) {
          cleanupsAfter.push(await viewStateFacet.getArchaeologistCleanupsCount(arch.archAddress));
        }

        // For each archaeologist, if the arch was accused expect the count to have increased by 1
        for (let i = 0; i < archaeologists.length; i++) {
          const arch = archaeologists[i];
          if (arch.archAddress === unaccusedArchaeologist.archAddress) {
            // expect clean up count after to be the same as clean up count before
            expect(cleanupsBefore[i].eq(cleanupsAfter[i])).to.be.true;
          } else {
            // expect cleanup count after to be clean up count before + 1
            expect(cleanupsBefore[i].add(1).eq(cleanupsAfter[i])).to.be.true;
          }
        }
      });

      it("should set the sarcophagus state to cleaned", async () => {
        const { sarcoId, thirdParty, thirdPartyFacet, viewStateFacet, resurrectionTime } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // increase time beyond resurrection time + grace period to expire sarcophagus
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increaseTo(resurrectionTime + +gracePeriod + 1);

        await thirdPartyFacet.connect(thirdParty).clean(sarcoId, thirdParty.address);

        const sarcophagus = await viewStateFacet.getSarcophagus(sarcoId);

        expect(sarcophagus.state).to.equal(SarcophagusState.Cleaned);
      });
    });

    context("Reverts", () => {
      it("Should revert if cleaning is attempted before sarco can be unwrapped, or attempted within its resurrection grace period", async () => {
        const { sarcoId, thirdParty, thirdPartyFacet, resurrectionTime } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // No time advancement before clean attempt
        const cleanTx = thirdPartyFacet.connect(thirdParty).clean(sarcoId, thirdParty.address);
        await expect(cleanTx).to.be.revertedWith("SarcophagusNotCleanable()");

        // Increasing time up to just around the sarco's resurrection time means it will still be within grace window
        await time.increaseTo(resurrectionTime);

        const cleanTxAgain = thirdPartyFacet.connect(thirdParty).clean(sarcoId, thirdParty.address);
        await expect(cleanTxAgain).to.be.revertedWith("SarcophagusNotCleanable()");
      });

      it("Should revert with SarcophagusDoesNotExist if sarco identifier is unknown", async () => {
        const { thirdParty, thirdPartyFacet } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        const tx = thirdPartyFacet
          .connect(thirdParty)
          .clean(formatBytes32String("unknown-sarcoId"), thirdParty.address);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("Should revert with SarcophagusDoesNotExist if cleaning an already cleaned sarcophagus", async () => {
        const { sarcoId, thirdParty, thirdPartyFacet, viewStateFacet, resurrectionTime } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // increase time beyond resurrection time + grace period to expire sarcophagus
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increaseTo(resurrectionTime + +gracePeriod + 1);

        // Clean the sarco once...
        await thirdPartyFacet.connect(thirdParty).clean(sarcoId, thirdParty.address);

        // ... and try again
        const tx = thirdPartyFacet.connect(thirdParty).clean(sarcoId, thirdParty.address);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });
    });
  });

  describe("accuse()", () => {
    context("when at least m unencrypted shards are provided", async () => {
      it("Should emit AccuseArchaeologist", async () => {
        const { archaeologists, sarcoId, thirdParty, thirdPartyFacet } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        const tx = thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          archaeologists.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        await expect(tx).to.emit(thirdPartyFacet, "AccuseArchaeologist");
      });

      it("updates the sarcophagus state to accused", async () => {
        const { archaeologists, sarcoId, thirdParty, thirdPartyFacet, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        let sarco = await viewStateFacet.getSarcophagus(sarcoId);
        expect(sarco.state).to.equal(SarcophagusState.Active);

        await thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          archaeologists.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        sarco = await viewStateFacet.getSarcophagus(sarcoId);
        expect(sarco.state).to.equal(SarcophagusState.Accused);
      });

      it("Should distribute half the sum of the accused archaeologists' digging fees to accuser, and other half to embalmer", async () => {
        const { archaeologists, sarcoId, thirdParty, thirdPartyFacet, embalmer, sarcoToken } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const embalmerBalanceBefore = await sarcoToken.balanceOf(embalmer.address);

        const paymentAccountBalanceBefore = await sarcoToken.balanceOf(thirdParty.address);

        expect(paymentAccountBalanceBefore.eq(0)).to.be.true;

        const accusedArchs = archaeologists.slice(0, threshold);

        await thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          accusedArchs.map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        // Set up amounts that should have been transferred to accuser and embalmer
        const totalDiggingFeesCursedBond = accusedArchs.reduce(
          (acc, arch) => [
            acc[0].add(arch.diggingFee),
            acc[1].add(calculateCursedBond(arch.diggingFee)),
          ],
          [BigNumber.from("0"), BigNumber.from("0")]
        );

        const totalDiggingFees = totalDiggingFeesCursedBond[0];
        const totalCursedBond = totalDiggingFeesCursedBond[1];

        const toEmbalmer = totalCursedBond.div(2);
        const toAccuser = totalCursedBond.sub(toEmbalmer);

        const embalmerBalanceAfter = await sarcoToken.balanceOf(embalmer.address);
        const paymentAccountBalanceAfter = await sarcoToken.balanceOf(thirdParty.address);

        // Check that embalmer and accuser now has balance that includes the amount that should have been transferred to them

        // embalmer should receive half cursed bond, PLUS  digging fees of failed archs
        const embalmerReward = toEmbalmer.add(totalDiggingFees);

        expect(embalmerBalanceAfter.eq(embalmerBalanceBefore.add(embalmerReward))).to.be.true;
        expect(paymentAccountBalanceAfter.eq(paymentAccountBalanceBefore.add(toAccuser))).to.be
          .true;
      });

      it("Should reduce cursed bond on storage of accused archaeologists after distributing their value, without increasing their free bond", async () => {
        const { archaeologists, sarcoId, thirdParty, thirdPartyFacet, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const accusedArchs = archaeologists.slice(0, threshold);

        // Cursed and free bonds before accuse:
        const cursedBondsBefore: BigNumber[] = [];
        const freeBondsBefore: BigNumber[] = [];
        for await (const arch of accusedArchs) {
          cursedBondsBefore.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsBefore.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        await thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          accusedArchs.map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        // Cursed and free bonds after accuse:
        const cursedBondsAfter: BigNumber[] = [];
        const freeBondsAfter: BigNumber[] = [];
        for await (const arch of accusedArchs) {
          cursedBondsAfter.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsAfter.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        for (let i = 0; i < cursedBondsAfter.length; i++) {
          // Check that accused archaeologist's cursed bonds have been reduced
          expect(cursedBondsBefore[i].gt(cursedBondsAfter[i])).to.be.true;

          // Check that accused archaeologist's free bonds have NOT been increased
          expect(freeBondsBefore[i].eq(freeBondsAfter[i])).to.be.true;
        }
      });

      it("Should un-curse the bond (on storage) of unaccused archaeologists", async () => {
        const { archaeologists, sarcoId, thirdParty, thirdPartyFacet, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Cursed and free bonds before accuse:
        const cursedBondsBefore: BigNumber[] = [];
        const freeBondsBefore: BigNumber[] = [];

        // Interested in just first 2 archs, which will be unaccused
        const unaccusedArchs = archaeologists.slice(0, 2);
        for await (const arch of unaccusedArchs) {
          cursedBondsBefore.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsBefore.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        await thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          // archaeologists[0], archaeologists[1] are unnaccused:
          archaeologists.slice(2, threshold + 2).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        // Cursed and free bonds after accuse:
        const cursedBondsAfter: BigNumber[] = [];
        const freeBondsAfter: BigNumber[] = [];
        for await (const arch of unaccusedArchs) {
          cursedBondsAfter.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsAfter.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        for (let i = 0; i < cursedBondsBefore.length; i++) {
          // Check that unaccused archaeologists' cursed bonds have been un-cursed
          expect(cursedBondsBefore[i].gt(cursedBondsAfter[i])).to.be.true;

          // Check that unaccused archaeologists' free bonds have been increased
          expect(freeBondsBefore[i].lt(freeBondsAfter[i])).to.be.true;
        }
      });

      it("does not transfer tokens of un-accused archaeologists", async () => {
        const { archaeologists, sarcoId, thirdParty, thirdPartyFacet, sarcoToken } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const unaccusedArchaeologistBalBefore = await sarcoToken.balanceOf(
          archaeologists[0].archAddress
        );

        await thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          archaeologists.slice(1, threshold + 1).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        const unaccusedArchaeologistBalAfter = await sarcoToken.balanceOf(
          archaeologists[0].archAddress
        );

        // Check that unaccused archaeologists balances are unaffected
        expect(unaccusedArchaeologistBalAfter.eq(unaccusedArchaeologistBalBefore)).to.be.true;
      });

      it("Should add all accused archaeologists to archaeologistAccusals storage on successful accusal", async () => {
        const { archaeologists, sarcoId, thirdParty, thirdPartyFacet, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const accusedArchs = archaeologists.slice(1, threshold + 1);

        // Get each archaeologist's accusal count before accuse
        const accusalsBefore: BigNumber[] = [];
        for (const arch of accusedArchs) {
          accusalsBefore.push(await viewStateFacet.getArchaeologistAccusalsCount(arch.archAddress));
        }

        // Accuse archaeologists
        await thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          accusedArchs.map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        // Get each archaeologist's accusal count after accuse
        const accusalsAfter: BigNumber[] = [];
        for (const arch of accusedArchs) {
          accusalsAfter.push(await viewStateFacet.getArchaeologistAccusalsCount(arch.archAddress));
        }

        // For each accused archaeologist, check that their accusal count has increased by 1
        for (let i = 0; i < accusedArchs.length; i++) {
          expect(accusalsAfter[i].eq(accusalsBefore[i].add(1))).to.be.true;
        }

        const goodArchAccusals = await viewStateFacet.getArchaeologistAccusalsCount(
          archaeologists[0].archAddress
        );

        // For each good archaeologist, check that their accusal count has NOT increased
        expect(goodArchAccusals.eq(accusalsBefore[0])).to.be.true;
      });
    });

    context("Reverts", () => {
      it("Should revert with SarcophagusIsUnwrappable() if called after resurrection time has passed (ie, accuse cannot fly because the sarco can be legally unwrapped)", async () => {
        const { archaeologists, sarcoId, thirdParty, thirdPartyFacet, resurrectionTime } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Increasing time up to just around the sarco's resurrection time means it will still be within grace window
        await time.increaseTo(resurrectionTime);

        const tx = thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          archaeologists.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        await expect(tx).to.be.revertedWith("SarcophagusIsUnwrappable()");
      });

      it("Should revert with NotEnoughProof() if less than m unencrypted shards are provided", async () => {
        const { archaeologists, sarcoId, thirdParty, thirdPartyFacet } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        const tx = thirdPartyFacet.connect(thirdParty).accuse(sarcoId, [], thirdParty.address);
        await expect(tx).to.be.revertedWith("AccuseNotEnoughProof");

        const tx2 = thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          archaeologists.slice(0, threshold - 1).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );
        await expect(tx2).to.be.revertedWith("AccuseNotEnoughProof");
      });

      it("Should revert with AccuseIncorrectProof if at least m unencrypted shards are provided, but one or more are invalid", async () => {
        const { archaeologists, sarcoId, thirdParty, thirdPartyFacet } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        const tx2 = thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          archaeologists
            .slice(0, threshold)
            .map(a => hashBytes(a.unencryptedShard).replace("a", "b")),
          thirdParty.address
        );
        await expect(tx2).to.be.revertedWith("AccuseIncorrectProof");
      });

      it("Should revert with SarcophagusDoesNotExist if sarco identifier is unknown", async () => {
        const { archaeologists, thirdParty, thirdPartyFacet } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        const tx = thirdPartyFacet.connect(thirdParty).accuse(
          formatBytes32String("unknown-id"),
          archaeologists.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );
        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("Should revert with SarcophagusDoesNotExist if calling accuse on a previously accused sarcophagus", async () => {
        const { archaeologists, sarcoId, thirdParty, thirdPartyFacet } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        await thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          archaeologists.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        const tx = thirdPartyFacet.connect(thirdParty).accuse(
          sarcoId,
          archaeologists.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );
        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });
    });
  });
});
