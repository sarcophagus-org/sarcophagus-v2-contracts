import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { hexlify } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { archeologistsFixture } from "../fixtures/archaeologists-fixture";
import { createSarcoFixture } from "../fixtures/create-sarco-fixture";
import { finalizeTransferFixture } from "../fixtures/finalize-transfer-fixture";
import { calculateCursedBond, registerArchaeologist, sign, updateArchaeologist } from "../utils/helpers";
import time from "../utils/time";

describe("Contract: ArchaeologistFacet", () => {
  describe("registerArchaeologist", () => {
    it("registers an archaeologist", async () => {
      const { archaeologists, archaeologistFacet, viewStateFacet } = await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      await registerArchaeologist(archaeologist, archaeologistFacet);

      const registeredArch = await viewStateFacet.getArchaeologistProfile(
        archaeologist.archAddress
      );
      expect(registeredArch.exists).to.be.true;
    });

    it("fails to register an archaeologist when it is already registered", async () => {
      const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);

      const archaeologist = archaeologists[0];

      await registerArchaeologist(archaeologist, archaeologistFacet);

      await expect(registerArchaeologist(archaeologist, archaeologistFacet)).to.be.revertedWith(
        "ArchaeologistProfileExistsShouldBe"
      );
    });

    it("initializes the cursedBond and rewards to 0", async () => {
      const { archaeologists, archaeologistFacet, viewStateFacet } = await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      await registerArchaeologist(archaeologist, archaeologistFacet);

      const registeredArch = await viewStateFacet.getArchaeologistProfile(
        archaeologist.archAddress
      );
      expect(registeredArch.cursedBond).to.equal(BigNumber.from("0"));
      expect(registeredArch.rewards).to.equal(BigNumber.from("0"));
    });

    it("initializes the profile config values correctly", async () => {
      const { archaeologists, archaeologistFacet, viewStateFacet } = await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      const minDiggingFee = "40";
      const maxRewrapInterval = "50";
      const freeBond = "90";

      await registerArchaeologist(
        archaeologist,
        archaeologistFacet,
        minDiggingFee,
        maxRewrapInterval,
        freeBond
      );

      const registeredArch = await viewStateFacet.getArchaeologistProfile(
        archaeologist.archAddress
      );
      expect(registeredArch.minimumDiggingFee).to.equal(BigNumber.from(minDiggingFee));
      expect(registeredArch.maximumRewrapInterval).to.equal(BigNumber.from(maxRewrapInterval));
      expect(registeredArch.freeBond).to.equal(BigNumber.from(freeBond));
    });

    it("adds the archaeologist address to the archaeologistProfileAddresses array", async () => {
      const { archaeologists, archaeologistFacet, viewStateFacet } = await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      await registerArchaeologist(archaeologist, archaeologistFacet,);

      const registeredArchAddress = await viewStateFacet.getArchaeologistProfileAddressAtIndex(0);
      expect(registeredArchAddress).to.equal(archaeologist.archAddress);
    });

    it("deposits free bond to the sarcophagus contract when registering with a positive free bond value", async () => {
      const { archaeologists, archaeologistFacet, sarcoToken } = await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      const minDiggingFee = "40";
      const maxRewrapInterval = "50";
      const freeBond = "90";

      // hopefully someday chai will support to.be.changed.by matchers for contracts/bignums
      const sarcoContractBalanceBefore = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );

      await registerArchaeologist(
        archaeologist,
        archaeologistFacet,
        minDiggingFee,
        maxRewrapInterval,
        freeBond
      );

      const sarcoContractBalanceAfter = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );

      expect(sarcoContractBalanceAfter.sub(sarcoContractBalanceBefore))
        .to.equal(BigNumber.from(freeBond));
    });
  });

  describe("updateArchaeologist", () => {
    it("updates an archaeologist values successfully", async () => {
      const { archaeologists, archaeologistFacet, viewStateFacet } = await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      await registerArchaeologist(archaeologist, archaeologistFacet);

      const minDiggingFee = "150";
      const maxRewrapInterval = "150";
      const freeBond = "150";

      const archFreeBondBeforeUpdate = await viewStateFacet.getFreeBond(archaeologist.archAddress);

      await updateArchaeologist(
        archaeologist,
        archaeologistFacet,
        minDiggingFee,
        maxRewrapInterval,
        freeBond
      );

      const registeredArch = await viewStateFacet.getArchaeologistProfile(
        archaeologist.archAddress
      );
      expect(registeredArch.minimumDiggingFee).to.equal(BigNumber.from(minDiggingFee));
      expect(registeredArch.maximumRewrapInterval).to.equal(BigNumber.from(maxRewrapInterval));
      expect(registeredArch.freeBond.sub(archFreeBondBeforeUpdate)).to.equal(
        BigNumber.from(freeBond)
      );
    });

    it("deposits free bond to the sarcophagus contract when updating with a positive free bond value", async () => {
      const { archaeologists, archaeologistFacet, sarcoToken } = await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      const minDiggingFee = "40";
      const maxRewrapInterval = "50";
      const freeBond = "90";

      await registerArchaeologist(
        archaeologist,
        archaeologistFacet,
        minDiggingFee,
        maxRewrapInterval,
        freeBond
      );

      const sarcoContractBalanceBefore = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );

      await updateArchaeologist(
        archaeologist,
        archaeologistFacet,
        minDiggingFee,
        maxRewrapInterval,
        freeBond
      );

      const sarcoContractBalanceAfter = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );

      expect(sarcoContractBalanceAfter.sub(sarcoContractBalanceBefore))
        .to.equal(BigNumber.from(freeBond));
    });

    it("reverts when an archaeologist is not registered", async () => {
      const { archaeologists, archaeologistFacet, viewStateFacet } = await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      await expect(updateArchaeologist(
        archaeologist,
        archaeologistFacet,
        "150",
        "150",
        "150"
      )).to.be.revertedWith("ArchaeologistProfileExistsShouldBe");
    });
  });

  describe("depositFreeBond()", () => {
    context("with an unregistered archaeologist", () => {
      it("reverts when depositing free bond", async () => {
        const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);
        const archaeologist = archaeologists[0];

        await expect(
          archaeologistFacet.connect(archaeologist.signer).depositFreeBond(BigNumber.from(100))
        ).to.be.revertedWith("ArchaeologistProfileExistsShouldBe");
      });
    });

    context("with a registered archaeologist", () => {
      it("deposits free bond to the contract", async () => {
        // Setup archaeologist + register
        const { archaeologists, archaeologistFacet, viewStateFacet, sarcoToken } =
          await archeologistsFixture(1);

        const archaeologist = archaeologists[0];
        await registerArchaeologist(archaeologist, archaeologistFacet);

        const amountToDeposit = "100";
        const archaeologistSarcoBalanceBefore = await sarcoToken.balanceOf(
          archaeologist.archAddress
        );

        await archaeologistFacet
          .connect(archaeologist.signer)
          .depositFreeBond(BigNumber.from(amountToDeposit));

        const freeBond = await viewStateFacet.getFreeBond(archaeologist.archAddress);
        expect(freeBond.toString()).to.equal(amountToDeposit);

        const archaeologistSarcoBalanceAfter = await sarcoToken.balanceOf(
          archaeologist.archAddress
        );

        expect(
          archaeologistSarcoBalanceAfter.add(BigNumber.from(amountToDeposit)).toString()
        ).to.equal(archaeologistSarcoBalanceBefore.toString());

        const contractSarcBalance = await sarcoToken.balanceOf(archaeologistFacet.address);
        expect(contractSarcBalance.toString()).to.equal(amountToDeposit);
      });

      it("emits event DepositFreeBond()", async () => {
        const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);
        const archaeologist = archaeologists[0];

        await registerArchaeologist(archaeologist, archaeologistFacet);

        const tx = archaeologistFacet
          .connect(archaeologist.signer)
          .depositFreeBond(BigNumber.from(100));

        await expect(tx)
          .emit(archaeologistFacet, "DepositFreeBond")
          .withArgs(archaeologist.archAddress, 100);
      });
    });

    it("reverts if deposit amount is negative", async () => {
      const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);

      // Try to deposit a negative amount
      await expect(
        archaeologistFacet.connect(archaeologists[0].signer).depositFreeBond(BigNumber.from(-1))
      ).to.be.reverted;
    });
  });

  describe("withdrawFreeBond()", () => {
    context("with an unregistered archaeologist", () => {
      it("reverts when withdrawing free bond", async () => {
        const { archaeologists, archaeologistFacet, viewStateFacet, sarcoToken } =
          await archeologistsFixture(1);
        const archaeologist = archaeologists[0];

        await expect(
          archaeologistFacet.connect(archaeologist.signer).withdrawFreeBond(BigNumber.from(100))
        ).to.be.reverted;
      });
    });

    context("with a registered archaeologist with positive free bond deposit", () => {
      context("Successful withdrawals", () => {
        it("withdraws free bond from the contract", async () => {
          const { archaeologists, archaeologistFacet, viewStateFacet, sarcoToken } =
            await archeologistsFixture(1);
          const contextArchaeologist = archaeologists[0];
          await registerArchaeologist(contextArchaeologist, archaeologistFacet);

          const archBalanceBefore = await sarcoToken.balanceOf(contextArchaeologist.archAddress);

          // Put some free bond on the contract so we can withdraw it
          await archaeologistFacet
            .connect(contextArchaeologist.signer)
            .depositFreeBond(BigNumber.from(100));

          // Withdraw free bond
          await archaeologistFacet
            .connect(contextArchaeologist.signer)
            .withdrawFreeBond(BigNumber.from(100));

          const freeBond = await viewStateFacet.getFreeBond(contextArchaeologist.archAddress);
          expect(freeBond.toString()).to.equal("0");

          const archBalanceAfter = await sarcoToken.balanceOf(contextArchaeologist.archAddress);

          expect(archBalanceAfter.toString()).to.equal(archBalanceBefore.toString());

          const contractSarcBalance = await sarcoToken.balanceOf(archaeologistFacet.address);
          expect(contractSarcBalance.toString()).to.equal("0");
        });

        it("should emit an event when the free bond is withdrawn", async () => {
          const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);
          const contextArchaeologist = archaeologists[0];
          await registerArchaeologist(contextArchaeologist, archaeologistFacet);

          // Put some free bond on the contract so we can withdraw it
          await archaeologistFacet
            .connect(contextArchaeologist.signer)
            .depositFreeBond(BigNumber.from(100));

          const tx = archaeologistFacet
            .connect(contextArchaeologist.signer)
            .withdrawFreeBond(BigNumber.from(100));

          await expect(tx)
            .to.emit(archaeologistFacet, "WithdrawFreeBond")
            .withArgs(contextArchaeologist.archAddress, 100);
        });

        it("should emit a transfer event when the sarco token is transfered", async () => {
          const { archaeologists, archaeologistFacet, sarcoToken } = await archeologistsFixture(1);
          const contextArchaeologist = archaeologists[0];
          await registerArchaeologist(contextArchaeologist, archaeologistFacet);

          // Put some free bond on the contract so we can withdraw it
          await archaeologistFacet
            .connect(contextArchaeologist.signer)
            .depositFreeBond(BigNumber.from(100));

          // Withdraw free bond
          const tx = await archaeologistFacet
            .connect(contextArchaeologist.signer)
            .withdrawFreeBond(BigNumber.from(100));
          await expect(tx).emit(sarcoToken, "Transfer");
        });
      });

      context("Failed withdrawals", () => {
        it("reverts if amount is negative", async () => {
          const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);
          const contextArchaeologist = archaeologists[0];
          await registerArchaeologist(contextArchaeologist, archaeologistFacet);

          // Put some free bond on the contract so we can withdraw it
          await archaeologistFacet
            .connect(contextArchaeologist.signer)
            .depositFreeBond(BigNumber.from(100));

          // Try to withdraw a negative amount
          await expect(archaeologistFacet.withdrawFreeBond(BigNumber.from(-1))).to.be.reverted;
        });

        it("reverts on attempt to withdraw more than free bond", async () => {
          const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);
          const contextArchaeologist = archaeologists[0];
          await registerArchaeologist(contextArchaeologist, archaeologistFacet);

          // Put some free bond on the contract so we can withdraw it
          await archaeologistFacet
            .connect(contextArchaeologist.signer)
            .depositFreeBond(BigNumber.from(100));

          // Try to withdraw with a non-archaeologist address
          await expect(
            archaeologistFacet
              .connect(contextArchaeologist.signer)
              .withdrawFreeBond(BigNumber.from(101))
          ).to.be.revertedWith("NotEnoughFreeBond");
        });
      });
    });
  });

  describe("unwrapSarcophagus()", () => {
    const shares = 5;
    const threshold = 2;

    context("Successful unwrap", () => {
      it("should store the unencrypted shard on the contract", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        // Check that the unencrypted shard is stored on the contract
        const archaeologist = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          archaeologists[0].archAddress
        );

        expect(archaeologist.unencryptedShard).to.equal(
          hexlify(archaeologists[0].unencryptedShard)
        );
      });

      it("should free up the archaeologist's cursed bond", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Get the cursed bond amount of the first archaeologist before initialize
        const cursedBondAmountBefore = await viewStateFacet.getCursedBond(
          archaeologists[0].archAddress
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        // Get the cursed bond amount of the first archaeologist after unwrapping
        const cursedBondAmountAfter = await viewStateFacet.getCursedBond(
          archaeologists[0].archAddress
        );

        // Check that the cursed bond amount has been freed up.
        expect(cursedBondAmountBefore).to.equal(
          calculateCursedBond(archaeologists[0].diggingFee)
        );
        expect(cursedBondAmountAfter).to.equal(0);
      });

      it("should add this sarcophagus to the archaeologist's successful sarcophagi", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        const isSuccessfulSarcophagus = await viewStateFacet.getArchaeologistSuccessOnSarcophagus(
          archaeologists[0].archAddress,
          sarcoId
        );

        expect(isSuccessfulSarcophagus).to.be.true;
      });

      it("should transfer the digging fee to the archaeologist's reward pool without transferring tokens", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, sarcoToken, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Calculate the digging fee for the first archaeologist
        const totalFees = archaeologists[0].diggingFee;

        // Get the sarco balance of the first archaeologist before unwrap
        const sarcoBalanceBefore = await sarcoToken.balanceOf(archaeologists[0].archAddress);
        const archRewardsBefore = await viewStateFacet.getAvailableRewards(
          archaeologists[0].archAddress
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        // Get the sarco balance of the first archaeologist after unwrap
        const sarcoBalanceAfter = await sarcoToken.balanceOf(archaeologists[0].archAddress);
        const archRewardsAfter = await viewStateFacet.getAvailableRewards(
          archaeologists[0].archAddress
        );

        // Check that the difference between the before and after rewards is
        // equal to the total fees, and actual token balance is unchanged
        expect(sarcoBalanceAfter.toString()).to.equal(sarcoBalanceBefore.toString());
        expect(archRewardsAfter.toString()).to.equal(archRewardsBefore.add(totalFees).toString());
      });

      it("should emit UnwrapSarcophagus()", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        // Check that the list of events includes an event that has an address
        // matching the embalmerFacet address
        await expect(tx).emit(archaeologistFacet, "UnwrapSarcophagus");
      });
    });

    context("Failed unwrap", () => {
      it("should revert if the sarcophagus does not exist", async () => {
        const { archaeologists, archaeologistFacet } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(falseIdentifier, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sender is not an archaeologist on this sarcophagus", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, recipient } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(recipient)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("ArchaeologistNotOnSarcophagus");
      });

      it("should revert if unwrap is called before the resurrection time has passed", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("TooEarlyToUnwrap");
      });

      it("should revert if unwrap is called after the resurrection window has expired", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 2 weeks in the future
        await time.increase(time.duration.weeks(2));

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("TooLateToUnwrap");
      });

      it("should revert if this archaeologist has already unwrapped this sarcophagus", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        (
          await archaeologistFacet
            .connect(archaeologists[0].signer)
            .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard)
        ).wait();

        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("ArchaeologistAlreadyUnwrapped");
      });

      it("should revert if the hash of the unencrypted shard does not match the hashed shard stored on the sarcophagus", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, Buffer.from("somethingElse"));
        const tx2 = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[1].unencryptedShard);

        await expect(tx).to.be.revertedWith("UnencryptedShardHashMismatch");
        await expect(tx2).to.be.revertedWith("UnencryptedShardHashMismatch");
      });

      it("should revert if the sarcophagus is not finalized", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold, skipFinalize: true },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("SarcophagusNotFinalized");
      });
    });
  });

  describe("finalizeTransfer()", () => {
    const shares = 5;
    const threshold = 2;

    context("Successful transfer", () => {
      it("should update the list of archaeologists on a sarcophagus", async () => {
        const { tx, oldArchaeologist, newArchaeologist, sarcoId, viewStateFacet } =
          await finalizeTransferFixture();
        await tx;

        const archaeologistAddresses = (await viewStateFacet.getSarcophagus(sarcoId))
          .archaeologists;

        expect(archaeologistAddresses).to.have.lengthOf(shares);
        expect(archaeologistAddresses).to.contain(newArchaeologist.archAddress);
        expect(archaeologistAddresses).to.not.contain(oldArchaeologist.address);
      });

      it("should transfer the old archaeologists nft to the new archaeologist", async () => {
        const {
          tx,
          curses,
          newArchaeologist,
          oldArchaeologist,
          sarcoId,
          viewStateFacet,
          deployer,
        } = await finalizeTransferFixture();
        await tx;

        const tokenId = (
          await viewStateFacet.getSarcophagusArchaeologist(sarcoId, newArchaeologist.archAddress)
        ).curseTokenId;

        const oldArchBalance = await curses.balanceOf(oldArchaeologist.address, tokenId);
        const newArchBalance = await curses.balanceOf(newArchaeologist.archAddress, tokenId);

        expect(oldArchBalance.toString()).to.equal("0");
        expect(newArchBalance.toString()).to.equal("1");
      });

      it("should update the data in the sarcophagusArchaeologists mapping", async () => {
        const { oldArchaeologist, newArchaeologist, sarcoId, viewStateFacet } =
          await finalizeTransferFixture();

        // Check that new archaeologist has some legitimate data
        const newArchaeologistData = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          newArchaeologist.archAddress
        );

        expect(newArchaeologistData.doubleHashedShard).to.not.equal(ethers.constants.HashZero);
        expect(newArchaeologistData.doubleHashedShard).to.not.equal(ethers.constants.HashZero);
        expect(newArchaeologistData.doubleHashedShard).to.not.equal(ethers.constants.HashZero);

        // Check that the old archaeologist's values are reset to default values
        const oldArchaeologistData = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          oldArchaeologist.address
        );

        expect(oldArchaeologistData.doubleHashedShard).to.equal(ethers.constants.HashZero);

        expect(oldArchaeologistData.doubleHashedShard).to.equal(ethers.constants.HashZero);

        expect(oldArchaeologistData.doubleHashedShard).to.equal(ethers.constants.HashZero);
        expect(oldArchaeologistData.diggingFee).to.equal("0");
      });

      it("should add the arweave transaction id to the list of arweaveTxIds on the sarcophagus", async () => {
        const { arweaveTxId, sarcoId, viewStateFacet } = await finalizeTransferFixture();

        const arweaveTxIds = (await viewStateFacet.getSarcophagus(sarcoId)).arweaveTxIds;

        expect(arweaveTxIds).to.have.lengthOf(2);
        expect(arweaveTxIds).to.contain(arweaveTxId);
      });

      it("should free the old archaeologists bond", async () => {
        const {
          bondAmount,
          oldArchaeologistFreeBondBefore,
          oldArchaeologistFreeBondAfter,
          oldArchaeologistCursedBondBefore,
          oldArchaeologistCursedBondAfter,
        } = await finalizeTransferFixture();

        // Check that the difference betwwen the old and new cursed bonds is equal to
        // the bond amount
        expect(oldArchaeologistCursedBondBefore.sub(oldArchaeologistCursedBondAfter)).to.equal(
          bondAmount.toString()
        );

        // Check that the difference betwwen the old and new free bonds is equal to
        // the bond amount
        expect(oldArchaeologistFreeBondAfter.sub(oldArchaeologistFreeBondBefore)).to.equal(
          bondAmount.toString()
        );
      });

      it("should curse the new archaeologists bond", async () => {
        const {
          newArchaeologistCursedBondBefore,
          newArchaeologistCursedBondAfter,
          newArchaeologistFreeBondBefore,
          newArchaeologistFreeBondAfter,
          bondAmount,
        } = await finalizeTransferFixture();

        // Check that the difference betwwen the old and new cursed bonds is equal to
        // the bond amount
        expect(newArchaeologistCursedBondAfter.sub(newArchaeologistCursedBondBefore)).to.equal(
          bondAmount.toString()
        );

        // Check that the difference betwwen the new and new free bonds is equal to
        // the bond amount
        expect(newArchaeologistFreeBondBefore.sub(newArchaeologistFreeBondAfter)).to.equal(
          bondAmount.toString()
        );
      });

      it("should emit FinalizeTransfer()", async () => {
        const {
          tx,
          archaeologistFacet,
          oldArchaeologist,
          newArchaeologist,
          sarcoId,
          arweaveTxId,
          viewStateFacet,
        } = await finalizeTransferFixture();

        const tokenId = (
          await viewStateFacet.getSarcophagusArchaeologist(sarcoId, newArchaeologist.archAddress)
        ).curseTokenId;

        await expect(tx)
          .emit(archaeologistFacet, "FinalizeTransfer")
          .withArgs(
            sarcoId,
            arweaveTxId,
            oldArchaeologist.address,
            newArchaeologist.archAddress,
            tokenId
          );
      });
    });

    context("Failed transfer", () => {
      it("should revert if the sarcophagus does not exist", async () => {
        const { archaeologists, archaeologistFacet, arweaveTxId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

        const unnamedSigners = await ethers.getUnnamedSigners();
        const newArchaeologist = unnamedSigners[unnamedSigners.length - archaeologists.length - 1];

        const oldArchaeologist = archaeologists[1].signer;
        const oldArchaeologistSignature = await sign(oldArchaeologist, arweaveTxId, "string");

        const tx = archaeologistFacet
          .connect(newArchaeologist)
          .finalizeTransfer(falseIdentifier, arweaveTxId, oldArchaeologistSignature);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sarcophagus has not been finalized", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, arweaveTxId } =
          await createSarcoFixture({ shares, threshold, skipFinalize: true }, "Test Sarco");

        const unnamedSigners = await ethers.getUnnamedSigners();
        const newArchaeologist = unnamedSigners[unnamedSigners.length - archaeologists.length - 1];

        const oldArchaeologist = archaeologists[1].signer;
        const oldArchaeologistSignature = await sign(oldArchaeologist, arweaveTxId, "string");

        const tx = archaeologistFacet
          .connect(newArchaeologist)
          .finalizeTransfer(sarcoId, arweaveTxId, oldArchaeologistSignature);

        await expect(tx).to.be.revertedWith("SarcophagusNotFinalized");
      });

      it("should revert if the resurrection time has passed", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, arweaveTxId } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const unnamedSigners = await ethers.getUnnamedSigners();
        const newArchaeologist = unnamedSigners[unnamedSigners.length - archaeologists.length - 1];

        const oldArchaeologist = archaeologists[1].signer;
        const oldArchaeologistSignature = await sign(oldArchaeologist, arweaveTxId, "string");

        await time.increase(time.duration.weeks(2));

        const tx = archaeologistFacet
          .connect(newArchaeologist)
          .finalizeTransfer(sarcoId, arweaveTxId, oldArchaeologistSignature);

        await expect(tx).to.be.revertedWith("ResurrectionTimeInPast");
      });

      it("should revert if the provided signature is not from an archaeologist on the sarcophagus", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, arweaveTxId } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const unnamedSigners = await ethers.getUnnamedSigners();
        const newArchaeologist = unnamedSigners[unnamedSigners.length - archaeologists.length - 1];

        const oldArchaeologistSignature = await sign(unnamedSigners[10], arweaveTxId, "string");

        const tx = archaeologistFacet
          .connect(newArchaeologist)
          .finalizeTransfer(sarcoId, arweaveTxId, oldArchaeologistSignature);

        await expect(tx).to.be.revertedWith("SignerNotArchaeologistOnSarcophagus");
      });

      it("should revert if the provided signature is not a signature of the arweave transaction id", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, arweaveTxId } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const unnamedSigners = await ethers.getUnnamedSigners();
        const newArchaeologist = unnamedSigners[unnamedSigners.length - archaeologists.length - 1];

        const oldArchaeologist = archaeologists[1].signer;

        const fakeArweaveTxId =
          "somethingelsethatisnotthearweavetxidliksomerandomstringlikethisoneitcouldbedogbreedsorcarnameslikeschnauzerorporsche";

        const oldArchaeologistSignature = await sign(oldArchaeologist, fakeArweaveTxId, "string");

        const tx = archaeologistFacet
          .connect(newArchaeologist)
          .finalizeTransfer(sarcoId, arweaveTxId, oldArchaeologistSignature);

        await expect(tx).to.be.revertedWith("SignerNotArchaeologistOnSarcophagus");
      });
    });
  });
});
