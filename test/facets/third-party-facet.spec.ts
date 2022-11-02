import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import time from "../utils/time";
import { calculateCursedBond } from "../utils/helpers";
import { createVaultFixture } from "../fixtures/create-vault-fixture";
import { BigNumber } from "ethers";
import { formatBytes32String } from "ethers/lib/utils";
import { hashBytes } from "../fixtures/spawn-signatories";

describe("Contract: ThirdPartyFacet", () => {
  const shares = 5;
  const threshold = 3;

  describe("clean()", () => {
    context("When successful", () => {
      it("Should distribute sum of cursed bonds of bad-acting signatories to vaultOwner and the address specified by cleaner", async () => {
        const {
          signatories,
          signatoryFacet,
          vaultId,
          vaultToken,
          vaultOwner,
          thirdParty,
          thirdPartyFacet,
          viewStateFacet,
          resurrectionTime,
        } = await createVaultFixture({ shares, threshold }, "Test Vault");

        // Increase time to when vault can be unwrapped
        await time.increaseTo(resurrectionTime);

        const unaccusedSignatory = signatories[0];

        // unaccusedSignatory will fulfil their duty
        await signatoryFacet
          .connect(unaccusedSignatory.signer)
          .unwrapVault(vaultId, unaccusedSignatory.unencryptedShard);

        // increase time beyond grace period to expire vault
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increase(+gracePeriod + 1);

        const vaultOwnerBalanceBefore = await vaultToken.balanceOf(vaultOwner.address);
        const paymentAccountBalanceBefore = await vaultToken.balanceOf(thirdParty.address);

        // before cleaning...
        expect(paymentAccountBalanceBefore).to.eq(0);

        await thirdPartyFacet.connect(thirdParty).clean(vaultId, thirdParty.address);

        const vaultOwnerBalanceAfter = await vaultToken.balanceOf(vaultOwner.address);
        const paymentAccountBalanceAfter = await vaultToken.balanceOf(thirdParty.address);

        // after cleaning, calculate sum, and verify on exact amounts instead
        // Set up amounts that should have been transferred to accuser and vaultOwner
        // ie, rewards of failed signatories
        const sumDiggingFees = signatories
          .slice(1) // signatories[0] did their job, so not included
          .reduce((acc, arch) => [acc[0].add(arch.diggingFee)], [BigNumber.from("0")]);

        const totalDiggingFees = sumDiggingFees[0];

        const cursedBond = calculateCursedBond(totalDiggingFees);
        const tovaultOwner = cursedBond.div(2);
        const toCleaner = cursedBond.sub(tovaultOwner);

        // Check that vaultOwner and accuser now have balance that includes the amount that should have been transferred to them

        // vaultOwner should receive half cursed bond, PLUS digging fees of failed archs
        const vaultOwnerReward = tovaultOwner.add(totalDiggingFees);

        expect(vaultOwnerBalanceAfter.eq(vaultOwnerBalanceBefore.add(vaultOwnerReward))).to.be.true;
        expect(paymentAccountBalanceAfter.eq(paymentAccountBalanceBefore.add(toCleaner))).to.be
          .true;
      });

      it("Should reduce cursed bonds on storage of signatories after distributing their value, without increasing free bond of bad-acting ones", async () => {
        const {
          signatories,
          signatoryFacet,
          vaultId,
          thirdParty,
          thirdPartyFacet,
          viewStateFacet,
          resurrectionTime,
        } = await createVaultFixture({ shares, threshold }, "Test Vault");

        // Cursed and free bonds before cleaning:
        const cursedBondsBefore = [];
        const freeBondsBefore = [];

        for await (const arch of signatories) {
          cursedBondsBefore.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsBefore.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        // Increase time to when vault can be unwrapped
        await time.increaseTo(resurrectionTime);

        // Have one arch actually do the unwrapping
        const unaccusedSignatory = signatories[0];
        await signatoryFacet
          .connect(unaccusedSignatory.signer)
          .unwrapVault(vaultId, unaccusedSignatory.unencryptedShard);

        // increase time beyond grace period to expire vault
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increase(+gracePeriod + 1);

        await thirdPartyFacet.connect(thirdParty).clean(vaultId, thirdParty.address);

        // Cursed and free bonds after cleaning:
        const cursedBondsAfter = [];
        const freeBondsAfter = [];

        for await (const arch of signatories) {
          cursedBondsAfter.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsAfter.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        // Check that good signatory's free bonds have been increased
        expect(freeBondsBefore[0].lt(freeBondsAfter[0])).to.be.true;

        for (let i = 0; i < cursedBondsBefore.length; i++) {
          // Check that all signatories' cursed bonds have been reduced
          expect(cursedBondsBefore[i].gt(cursedBondsAfter[i])).to.be.true;

          if (i !== 0) {
            // Check that accused signatory's free bonds have NOT been increased
            expect(freeBondsBefore[i].eq(freeBondsAfter[i])).to.be.true;
          }
        }
      });

      it("Should emit CleanUpVault on successful cleanup", async () => {
        const { vaultId, thirdParty, thirdPartyFacet, viewStateFacet, resurrectionTime } =
          await createVaultFixture({ shares, threshold }, "Test Vault");

        // increase time beyond resurrection time + grace period to expire vault
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increaseTo(resurrectionTime + +gracePeriod + 1);

        const tx = thirdPartyFacet.connect(thirdParty).clean(vaultId, thirdParty.address);

        await expect(tx).to.emit(thirdPartyFacet, "CleanUpVault");
      });

      it("Should increment count for all defaulting signatories to signatoryCleanups storage on successful cleanup", async () => {
        const {
          signatories,
          signatoryFacet,
          vaultId,
          thirdParty,
          thirdPartyFacet,
          viewStateFacet,
          resurrectionTime,
        } = await createVaultFixture({ shares, threshold }, "Test Vault");

        const unaccusedSignatory = signatories[0];

        // Have one arch actually do the unwrapping
        await time.increaseTo(resurrectionTime);
        await signatoryFacet
          .connect(unaccusedSignatory.signer)
          .unwrapVault(vaultId, unaccusedSignatory.unencryptedShard);

        // increase time beyond grace period to expire vault
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increase(+gracePeriod + 1);

        // Get the clean up count of each signatory before cleaning
        const cleanupsBefore: BigNumber[] = [];
        for (const arch of signatories) {
          cleanupsBefore.push(await viewStateFacet.getSignatoryCleanupsCount(arch.archAddress));
        }

        // Clean the vault
        await thirdPartyFacet.connect(thirdParty).clean(vaultId, thirdParty.address);

        // Get the clean up count of each signatory after cleaning
        const cleanupsAfter: BigNumber[] = [];
        for (const arch of signatories) {
          cleanupsAfter.push(await viewStateFacet.getSignatoryCleanupsCount(arch.archAddress));
        }

        // For each signatory, if the arch was accused expect the count to have increased by 1
        for (let i = 0; i < signatories.length; i++) {
          const arch = signatories[i];
          if (arch.archAddress === unaccusedSignatory.archAddress) {
            // expect clean up count after to be the same as clean up count before
            expect(cleanupsBefore[i].eq(cleanupsAfter[i])).to.be.true;
          } else {
            // expect cleanup count after to be clean up count before + 1
            expect(cleanupsBefore[i].add(1).eq(cleanupsAfter[i])).to.be.true;
          }
        }
      });
    });

    context("Reverts", () => {
      it("Should revert if cleaning is attempted before vault can be unwrapped, or attempted within its resurrection grace period", async () => {
        const { vaultId, thirdParty, thirdPartyFacet, resurrectionTime } = await createVaultFixture(
          { shares, threshold },
          "Test Vault"
        );

        // No time advancement before clean attempt
        const cleanTx = thirdPartyFacet.connect(thirdParty).clean(vaultId, thirdParty.address);
        await expect(cleanTx).to.be.revertedWith("VaultNotCleanable()");

        // Increasing time up to just around the vault's resurrection time means it will still be within grace window
        await time.increaseTo(resurrectionTime);

        const cleanTxAgain = thirdPartyFacet.connect(thirdParty).clean(vaultId, thirdParty.address);
        await expect(cleanTxAgain).to.be.revertedWith("VaultNotCleanable()");
      });

      it("Should revert with VaultDoesNotExist if vault identifier is unknown", async () => {
        const { thirdParty, thirdPartyFacet } = await createVaultFixture(
          { shares, threshold },
          "Test Vault"
        );

        const tx = thirdPartyFacet
          .connect(thirdParty)
          .clean(formatBytes32String("unknown-vaultId"), thirdParty.address);

        await expect(tx).to.be.revertedWith("VaultDoesNotExist");
      });

      it("Should revert with VaultDoesNotExist if cleaning an already cleaned vault", async () => {
        const { vaultId, thirdParty, thirdPartyFacet, viewStateFacet, resurrectionTime } =
          await createVaultFixture({ shares, threshold }, "Test Vault");

        // increase time beyond resurrection time + grace period to expire vault
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increaseTo(resurrectionTime + +gracePeriod + 1);

        // Clean the vault once...
        await thirdPartyFacet.connect(thirdParty).clean(vaultId, thirdParty.address);

        // ... and try again
        const tx = thirdPartyFacet.connect(thirdParty).clean(vaultId, thirdParty.address);

        await expect(tx).to.be.revertedWith("VaultDoesNotExist");
      });
    });
  });

  describe("accuse()", () => {
    context("when at least m unencrypted shards are provided", async () => {
      it("Should emit AccuseSignatory", async () => {
        const { signatories, vaultId, thirdParty, thirdPartyFacet } = await createVaultFixture(
          { shares, threshold },
          "Test Vault"
        );

        const tx = thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          signatories.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        await expect(tx).to.emit(thirdPartyFacet, "AccuseSignatory");
      });

      it("updates the vault state to DONE", async () => {
        const { signatories, vaultId, thirdParty, thirdPartyFacet, viewStateFacet } =
          await createVaultFixture({ shares, threshold }, "Test Vault");

        let vault = await viewStateFacet.getVault(vaultId);
        expect(vault.state).to.be.eq(1); // 1 is "Exists"

        await thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          signatories.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        vault = await viewStateFacet.getVault(vaultId);
        expect(vault.state).to.be.eq(2); // 2 is "Done"
      });

      it("Should distribute half the sum of the accused signatories' digging fees to accuser, and other half to vaultOwner", async () => {
        const { signatories, vaultId, thirdParty, thirdPartyFacet, vaultOwner, vaultToken } =
          await createVaultFixture({ shares, threshold }, "Test Vault");

        const vaultOwnerBalanceBefore = await vaultToken.balanceOf(vaultOwner.address);

        const paymentAccountBalanceBefore = await vaultToken.balanceOf(thirdParty.address);

        expect(paymentAccountBalanceBefore.eq(0)).to.be.true;

        const accusedArchs = signatories.slice(0, threshold);

        await thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          accusedArchs.map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        // Set up amounts that should have been transferred to accuser and vaultOwner
        const totalDiggingFeesCursedBond = accusedArchs.reduce(
          (acc, arch) => [
            acc[0].add(arch.diggingFee),
            acc[1].add(calculateCursedBond(arch.diggingFee)),
          ],
          [BigNumber.from("0"), BigNumber.from("0")]
        );

        const totalDiggingFees = totalDiggingFeesCursedBond[0];
        const totalCursedBond = totalDiggingFeesCursedBond[1];

        const tovaultOwner = totalCursedBond.div(2);
        const toAccuser = totalCursedBond.sub(tovaultOwner);

        const vaultOwnerBalanceAfter = await vaultToken.balanceOf(vaultOwner.address);
        const paymentAccountBalanceAfter = await vaultToken.balanceOf(thirdParty.address);

        // Check that vaultOwner and accuser now has balance that includes the amount that should have been transferred to them

        // vaultOwner should receive half cursed bond, PLUS  digging fees of failed archs
        const vaultOwnerReward = tovaultOwner.add(totalDiggingFees);

        expect(vaultOwnerBalanceAfter.eq(vaultOwnerBalanceBefore.add(vaultOwnerReward))).to.be.true;
        expect(paymentAccountBalanceAfter.eq(paymentAccountBalanceBefore.add(toAccuser))).to.be
          .true;
      });

      it("Should reduce cursed bond on storage of accused signatories after distributing their value, without increasing their free bond", async () => {
        const { signatories, vaultId, thirdParty, thirdPartyFacet, viewStateFacet } =
          await createVaultFixture({ shares, threshold }, "Test Vault");

        const accusedArchs = signatories.slice(0, threshold);

        // Cursed and free bonds before accuse:
        const cursedBondsBefore = [];
        const freeBondsBefore = [];
        for await (const arch of accusedArchs) {
          cursedBondsBefore.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsBefore.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        await thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          accusedArchs.map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        // Cursed and free bonds after accuse:
        const cursedBondsAfter = [];
        const freeBondsAfter = [];
        for await (const arch of accusedArchs) {
          cursedBondsAfter.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsAfter.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        for (let i = 0; i < cursedBondsAfter.length; i++) {
          // Check that accused signatory's cursed bonds have been reduced
          expect(cursedBondsBefore[i].gt(cursedBondsAfter[i])).to.be.true;

          // Check that accused signatory's free bonds have NOT been increased
          expect(freeBondsBefore[i].eq(freeBondsAfter[i])).to.be.true;
        }
      });

      it("Should un-curse the bond (on storage) of unaccused signatories", async () => {
        const { signatories, vaultId, thirdParty, thirdPartyFacet, viewStateFacet } =
          await createVaultFixture({ shares, threshold }, "Test Vault");

        // Cursed and free bonds before accuse:
        const cursedBondsBefore = [];
        const freeBondsBefore = [];

        // Interested in just first 2 archs, which will be unaccused
        const unaccusedArchs = signatories.slice(0, 2);
        for await (const arch of unaccusedArchs) {
          cursedBondsBefore.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsBefore.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        await thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          // signatories[0], signatories[1] are unnaccused:
          signatories.slice(2, threshold + 2).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        // Cursed and free bonds after accuse:
        const cursedBondsAfter = [];
        const freeBondsAfter = [];
        for await (const arch of unaccusedArchs) {
          cursedBondsAfter.push(await viewStateFacet.getCursedBond(arch.archAddress));
          freeBondsAfter.push(await viewStateFacet.getFreeBond(arch.archAddress));
        }

        for (let i = 0; i < cursedBondsBefore.length; i++) {
          // Check that unaccused signatories' cursed bonds have been un-cursed
          expect(cursedBondsBefore[i].gt(cursedBondsAfter[i])).to.be.true;

          // Check that unaccused signatories' free bonds have been increased
          expect(freeBondsBefore[i].lt(freeBondsAfter[i])).to.be.true;
        }
      });

      it("does not transfer tokens of un-accused signatories", async () => {
        const { signatories, vaultId, thirdParty, thirdPartyFacet, vaultToken } =
          await createVaultFixture({ shares, threshold }, "Test Vault");

        const unaccusedSignatoryBalBefore = await vaultToken.balanceOf(
          signatories[0].archAddress
        );

        await thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          signatories.slice(1, threshold + 1).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        const unaccusedSignatoryBalAfter = await vaultToken.balanceOf(
          signatories[0].archAddress
        );

        // Check that unaccused signatories balances are unaffected
        expect(unaccusedSignatoryBalAfter.eq(unaccusedSignatoryBalBefore)).to.be.true;
      });

      it("Should add all accused signatories to signatoryAccusals storage on successful accusal", async () => {
        const { signatories, vaultId, thirdParty, thirdPartyFacet, viewStateFacet } =
          await createVaultFixture({ shares, threshold }, "Test Vault");

        const accusedArchs = signatories.slice(1, threshold + 1);

        // Get each signatory's accusal count before accuse
        const accusalsBefore = [];
        for (const arch of accusedArchs) {
          accusalsBefore.push(await viewStateFacet.getSignatoryAccusalsCount(arch.archAddress));
        }

        // Accuse signatories
        await thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          accusedArchs.map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        // Get each signatory's accusal count after accuse
        const accusalsAfter = [];
        for (const arch of accusedArchs) {
          accusalsAfter.push(await viewStateFacet.getSignatoryAccusalsCount(arch.archAddress));
        }

        // For each accused signatory, check that their accusal count has increased by 1
        for (let i = 0; i < accusedArchs.length; i++) {
          expect(accusalsAfter[i].eq(accusalsBefore[i].add(1))).to.be.true;
        }

        const goodArchAccusals = await viewStateFacet.getSignatoryAccusalsCount(
          signatories[0].archAddress
        );

        // For each good signatory, check that their accusal count has NOT increased
        expect(goodArchAccusals.eq(accusalsBefore[0])).to.be.true;
      });
    });

    context("Reverts", () => {
      it("Should revert with VaultIsUnwrappable() if called after resurrection time has passed (ie, accuse cannot fly because the vault can be legally unwrapped)", async () => {
        const { signatories, vaultId, thirdParty, thirdPartyFacet, resurrectionTime } =
          await createVaultFixture({ shares, threshold }, "Test Vault");

        // Increasing time up to just around the vault's resurrection time means it will still be within grace window
        await time.increaseTo(resurrectionTime);

        const tx = thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          signatories.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        await expect(tx).to.be.revertedWith("VaultIsUnwrappable()");
      });

      it("Should revert with NotEnoughProof() if less than m unencrypted shards are provided", async () => {
        const { signatories, vaultId, thirdParty, thirdPartyFacet } = await createVaultFixture(
          { shares, threshold },
          "Test Vault"
        );

        const tx = thirdPartyFacet.connect(thirdParty).accuse(vaultId, [], thirdParty.address);
        await expect(tx).to.be.revertedWith("AccuseNotEnoughProof");

        const tx2 = thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          signatories.slice(0, threshold - 1).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );
        await expect(tx2).to.be.revertedWith("AccuseNotEnoughProof");
      });

      it("Should revert with AccuseIncorrectProof if at least m unencrypted shards are provided, but one or more are invalid", async () => {
        const { signatories, vaultId, thirdParty, thirdPartyFacet } = await createVaultFixture(
          { shares, threshold },
          "Test Vault"
        );

        const tx2 = thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          signatories
            .slice(0, threshold)
            .map(a => hashBytes(a.unencryptedShard).replace("a", "b")),
          thirdParty.address
        );
        await expect(tx2).to.be.revertedWith("AccuseIncorrectProof");
      });

      it("Should revert with VaultDoesNotExist if vault identifier is unknown", async () => {
        const { signatories, thirdParty, thirdPartyFacet } = await createVaultFixture(
          { shares, threshold },
          "Test Vault"
        );

        const tx = thirdPartyFacet.connect(thirdParty).accuse(
          formatBytes32String("unknown-id"),
          signatories.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );
        await expect(tx).to.be.revertedWith("VaultDoesNotExist");
      });

      it("Should revert with VaultDoesNotExist if calling accuse on a previously accused vault", async () => {
        const { signatories, vaultId, thirdParty, thirdPartyFacet } = await createVaultFixture(
          { shares, threshold },
          "Test Vault"
        );

        await thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          signatories.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );

        const tx = thirdPartyFacet.connect(thirdParty).accuse(
          vaultId,
          signatories.slice(0, threshold).map(a => hashBytes(a.unencryptedShard)),
          thirdParty.address
        );
        await expect(tx).to.be.revertedWith("VaultDoesNotExist");
      });
    });
  });
});
