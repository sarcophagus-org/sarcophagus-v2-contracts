import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import time from "../utils/time";
import { createSarcoFixture } from "../fixtures/create-sarco-fixture";
import { BigNumber } from "ethers";
import { formatBytes32String } from "ethers/lib/utils";
import { hashBytes } from "../fixtures/spawn-archaeologists";
import { SarcophagusState } from "../types";

describe("Contract: ThirdPartyFacet", () => {
  const shares = 5;
  const threshold = 3;

  describe("clean()", () => {

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
    });
  });

  describe("Accuse v2", () => {
    it("Should revert on a nonexistent sarcophagus ID", async () => {
    });
    it("Should revert if the current time is past the resurrectionTime", async () => {
    });
    it("Should not pay out any funds on an archaeologist who has already been accused", async () => {
    });
    it("Should refund bonds to all unaccused archaeologists and set the sarcophagus state to accused if k or more archaeologists have been accused", async () => {
    });
    it("Should not refund bonds to other archaeologists or change sarcophagus state if less than k archaeologists have been accused", async () => {
    });
    it("Should refund digging fees allocated by embalmer to accused archaeologists", async () => {
    });
    it("Should allow running two successful accusals on the same sarcophagus", async () => {
    });
    it("Should consider previous accusals when tracking whether or not k archaeologists have been accused and determining whether or not to free remaining bonds", async () => {
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
            acc[1].add(arch.diggingFee),
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

      it("Should revert with SarcophagusInactive if calling accuse on a previously accused sarcophagus", async () => {
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
        await expect(tx).to.be.revertedWith("SarcophagusInactive");
      });
    });
  });
});
