import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { VaultState } from "../types";
import { createVaultFixture } from "../fixtures/create-vault-fixture";
import { buryFixture } from "../fixtures/bury-fixture";
import { rewrapFixture } from "../fixtures/rewrap-fixture";
import { calculateCursedBond, sign, toVault } from "../utils/helpers";
import time from "../utils/time";

describe("Contract: vaultOwnerFacet", () => {
  const shares = 5;
  const threshold = 3;
  const sarcoName = "test init";

  describe("createVault()", () => {
    context("Successful creation", () => {
      it("should transfer fees in sarco token from the vaultOwner to the contract", async () => {
        const {
          deployer,
          sarcoToken,
          vaultOwner,
          signatories,
          vaultOwnerBalanceBeforeCreate,
          viewStateFacet,
        } = await createVaultFixture({ shares, threshold }, sarcoName);

        const vaultOwnerBalanceAfter = await sarcoToken.balanceOf(vaultOwner.address);

        // Calculate the total fees (all digging fees)
        const totalDiggingFees: BigNumber = signatories.reduce(
          (acc, arch) => acc.add(calculateCursedBond(arch.diggingFee)),
          ethers.constants.Zero
        );

        const protocolFee: BigNumber = await viewStateFacet
          .connect(deployer)
          .getProtocolFeeBasePercentage();

        const percentage = protocolFee.toNumber() / 100;
        const totalDiggingFeesNumber = Number.parseFloat(
          ethers.utils.formatEther(totalDiggingFees)
        );

        const additionalCost = ethers.utils.parseEther(
          (percentage * totalDiggingFeesNumber).toString()
        );
        const totalFees = totalDiggingFees.add(additionalCost);

        expect(vaultOwnerBalanceAfter.toString()).to.equal(
          vaultOwnerBalanceBeforeCreate.sub(totalFees).toString()
        );
      });

      it("emits CreateVault()", async () => {
        const { vaultOwnerFacet, createTx } = await createVaultFixture(
          { shares, threshold, skipAwaitCreateTx: true },
          sarcoName
        );

        await expect(createTx).to.emit(vaultOwnerFacet, "CreateVault");
      });

      it("stores the arweave transaction ids", async () => {
        const { sarcoId, viewStateFacet, arweaveTxIds } = await createVaultFixture(
          { shares, threshold },
          sarcoName
        );

        const sarcophagusStored = await viewStateFacet.getVault(sarcoId);
        expect(sarcophagusStored.arweaveTxIds.length).to.eq(2);
        expect(sarcophagusStored.arweaveTxIds[0]).to.eq(arweaveTxIds[0]);
        expect(sarcophagusStored.arweaveTxIds[1]).to.eq(arweaveTxIds[1]);
      });

      it("locks up an signatory's free bond", async () => {
        const {
          sarcoId,
          viewStateFacet,
          recipient,
          arweaveTxIds,
          vaultOwnerFacet,
          vaultOwner,
          signatories,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        const regularSignatory = signatories[1];

        const signatoryFreeBondBefore = await viewStateFacet.getFreeBond(
          regularSignatory.archAddress
        );
        const signatoryCursedBondBefore = await viewStateFacet.getCursedBond(
          regularSignatory.archAddress
        );

        await vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: 4,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        const signatoryFreeBondAfter = await viewStateFacet.getFreeBond(
          regularSignatory.archAddress
        );
        const signatoryCursedBondAfter = await viewStateFacet.getCursedBond(
          regularSignatory.archAddress
        );

        const bondAmount = calculateCursedBond(regularSignatory.diggingFee);

        // Check that the signatory's free bond afterward has descreased by the bond amount
        expect(signatoryFreeBondAfter).to.equal(signatoryFreeBondBefore.sub(bondAmount));

        // Check that the signatory's cursed bond has increased by the bond amount
        expect(signatoryCursedBondAfter).to.equal(
          signatoryCursedBondBefore.add(bondAmount)
        );
      });

      it("transfers the protocol fees from the vaultOwner to the contract", async () => {
        const _shares = 5;
        const _threshold = 3;
        const archMinDiggingFee = toVault(5);

        const {
          sarcoToken,
          viewStateFacet,
          vaultOwner,
          vaultOwnerFacet,
          sarcoId,
          recipient,
          signatories,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({
          shares: _shares,
          threshold: _threshold,
          archMinDiggingFee,
          skipCreateTx: true,
        });

        // Total min digging fees will be 25 SARCO (5 archs * 5 sarco digging fee)
        const totalDiggingFees = BigNumber.from(_shares).mul(archMinDiggingFee);
        // Protocol fee defaults to 1
        const protocolFee = await viewStateFacet.connect(vaultOwner).getProtocolFeeBasePercentage();
        // total protocol fees will be .25 SARCO (25 * 1 / 100)
        const expectedTotalProtocolFees = totalDiggingFees.mul(protocolFee).div(100);

        // validate balance after create sarcophagus
        const vaultOwnerBalanceBeforeCreate = await sarcoToken.balanceOf(vaultOwner.address);

        await vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: _threshold,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        // confirm that protocol fee amount is updated on the contract
        const actualTotalProtocolFees = await viewStateFacet
          .connect(vaultOwner)
          .getTotalProtocolFees();
        expect(actualTotalProtocolFees).to.equal(expectedTotalProtocolFees);

        // confirm vaultOwners SARCO balance has been debited
        const vaultOwnerBalanceAfterCreate = await sarcoToken.balanceOf(vaultOwner.address);
        expect(vaultOwnerBalanceAfterCreate).to.equal(
          vaultOwnerBalanceBeforeCreate.sub(totalDiggingFees).sub(expectedTotalProtocolFees)
        );
      });

      it("should set the correct maxRewrapInterval on a sarcophagus", async () => {
        const { sarcoId, viewStateFacet, maximumRewrapInterval } = await createVaultFixture(
          { shares, threshold },
          sarcoName
        );

        const sarco = await viewStateFacet.getVault(sarcoId);
        expect(sarco.maximumRewrapInterval).to.be.eq(maximumRewrapInterval);
      });
    });

    context("Failed createVault", () => {
      it("should revert when creating a sarcophagus that already exists", async () => {
        const {
          vaultOwner,
          vaultOwnerFacet,
          sarcoId,
          signatories,
          recipient,
          resurrectionTime,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({ shares, threshold }, sarcoName);

        // Try to create the same sarcophagus again
        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            canBeTransferred: true,
            minShards: threshold,
            maximumRewrapInterval,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("VaultAlreadyExists");
      });

      it("should revert if the resurrection time is not in the future", async () => {
        const {
          sarcoId,
          vaultOwnerFacet,
          vaultOwner,
          signatories,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        // Initialise the sarco with resurrection time 1 second in past
        const resurrectionTime = (await time.latest()) - 1;
        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: threshold,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("ResurrectionTimeInPast");
      });

      it("should revert if no signatories are provided", async () => {
        const {
          sarcoId,
          vaultOwnerFacet,
          vaultOwner,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        // Create the sarco without signatories
        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: threshold,
            timestamp,
          },
          [],
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("NoSignatoriesProvided");
      });

      it("should revert if the list of signatories is not unique", async () => {
        const {
          sarcoId,
          signatories,
          vaultOwnerFacet,
          vaultOwner,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        const nonUniqueSignatories = signatories.slice();
        nonUniqueSignatories.pop();
        const firstSignatory = signatories[0];
        nonUniqueSignatories.push(firstSignatory);

        // Create a sarcophagus as the vaultOwner
        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: threshold,
            timestamp,
          },
          nonUniqueSignatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("SignatoryListNotUnique");
      });

      it("should revert if minShards is greater than the number of signatories", async () => {
        const {
          sarcoId,
          signatories,
          vaultOwnerFacet,
          vaultOwner,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        // Create a sarcophagus as the vaultOwner
        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: signatories.length + 1,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("MinShardsGreaterThanSignatories");
      });

      it("should revert if minShards is 0", async () => {
        const {
          sarcoId,
          signatories,
          vaultOwnerFacet,
          vaultOwner,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        // Create a sarcophagus as the vaultOwner
        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: 0,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("MinShardsZero");
      });

      it("reverts if the arweave TX Id array is empty", async () => {
        const { createTx } = await createVaultFixture(
          {
            shares,
            threshold,
            arweaveTxIds: [],
            skipAwaitCreateTx: true,
          },
          sarcoName
        );

        await expect(createTx).to.be.revertedWith("ArweaveTxIdsInvalid");
      });

      it("reverts if the first arweave TX Id is empty", async () => {
        const { createTx } = await createVaultFixture(
          {
            shares,
            threshold,
            arweaveTxIds: ["", "notempty"],
            skipAwaitCreateTx: true,
          },
          sarcoName
        );

        await expect(createTx).to.be.revertedWith("ArweaveTxIdsInvalid");
      });

      it("reverts if second arweave TX Id is empty", async () => {
        const { createTx } = await createVaultFixture(
          {
            shares,
            threshold,
            arweaveTxIds: ["notempty", ""],
            skipAwaitCreateTx: true,
          },
          sarcoName
        );

        await expect(createTx).to.be.revertedWith("ArweaveTxIdsInvalid");
      });

      it("reverts if the vaultOwner does not provide enough digging fee", async () => {
        // Set min digging fees for each signatory profile to 10
        const {
          signatories,
          vaultOwner,
          vaultOwnerFacet,
          sarcoId,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture(
          {
            shares,
            threshold,
            archMinDiggingFee: BigNumber.from("10"),
            skipCreateTx: true,
          },
          sarcoName
        );

        // set one of the signatory's digging fees too low
        signatories[0].diggingFee = BigNumber.from("9");

        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: threshold,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("InvalidSignature");
      });

      it("reverts if any signature provided by a regular signatory is from the wrong signatory", async () => {
        const {
          vaultOwner,
          vaultOwnerFacet,
          sarcoId,
          signatories,
          recipient,
          resurrectionTime,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        const signers = await ethers.getSigners();

        // Get a false signer
        const falseSigner = signers[9];
        const falseSig = await sign(
          falseSigner,
          [signatories[0].unencryptedShardDoubleHash, arweaveTxIds[1]],
          ["bytes32", "string"]
        );
        signatories[0].v = falseSig.v;
        signatories[0].r = falseSig.r;
        signatories[0].s = falseSig.s;

        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: threshold,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("InvalidSignature");
      });

      it("reverts if any signatory signature includes the wrong data", async () => {
        const {
          vaultOwner,
          vaultOwnerFacet,
          sarcoId,
          signatories,
          recipient,
          resurrectionTime,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        const sigWithBadData = await sign(
          signatories[0].signer,
          [arweaveTxIds[1], signatories[0].unencryptedShardDoubleHash, "100", "100"],
          ["string", "bytes32", "uint256", "uint256"]
        );
        signatories[0].v = sigWithBadData.v;
        signatories[0].r = sigWithBadData.r;
        signatories[0].s = sigWithBadData.s;

        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: threshold,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("InvalidSignature");
      });

      it("should fail to create a sarcophagus with a resurrectionTime that exceeds the maxRewrapInterval", async () => {
        const {
          sarcoId,
          vaultOwnerFacet,
          vaultOwner,
          signatories,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        // Initialise the sarco with resurrection time 1 minute beyond maximum
        const resurrectionTime =
          (await time.latest()) + maximumRewrapInterval + time.duration.minutes(1);

        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: threshold,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("ResurrectionTimeTooFarInFuture");
      });
      it("should fail to create a sarcophagus where an signatory hasn't agreed to the supplied maxRewrapInterval", async () => {
        const {
          sarcoId,
          vaultOwnerFacet,
          vaultOwner,
          signatories,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          resurrectionTime,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);
        // change signatories[0]'s signature to use the wrong maximumRewrapInterval
        const disagreableSignatorySigner = await ethers.getSigner(
          signatories[0].archAddress
        );
        const disagreeingSignature = await sign(
          disagreableSignatorySigner,
          [
            arweaveTxIds[1],
            signatories[0].unencryptedShardDoubleHash,
            (maximumRewrapInterval + time.duration.minutes(1)).toString(),
            timestamp.toString(),
          ],
          ["string", "bytes32", "uint256", "uint256"]
        );
        signatories[0].r = disagreeingSignature.r;
        signatories[0].s = disagreeingSignature.s;
        signatories[0].v = disagreeingSignature.v;
        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: threshold,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("InvalidSignature");
      });

      it("should revert when creating a sarcophagus with an expired timestamp", async () => {
        const {
          sarcoId,
          viewStateFacet,
          recipient,
          arweaveTxIds,
          vaultOwnerFacet,
          vaultOwner,
          signatories,
          maximumRewrapInterval,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        const expirationThreshold = await viewStateFacet.getExpirationThreshold();

        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: 4,
            timestamp: (await time.latest()) - expirationThreshold.toNumber(),
          },
          signatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("VaultParametersExpired");
      });
      it("should revert when creating a sarcophagus with a timestamp an signatory hasn't agreed to", async () => {
        const {
          sarcoId,
          vaultOwnerFacet,
          vaultOwner,
          signatories,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          resurrectionTime,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);
        // change signatories[0]'s signature to use the wrong maximumRewrapInterval
        const disagreableSignatorySigner = await ethers.getSigner(
          signatories[0].archAddress
        );
        const disagreeingSignature = await sign(
          disagreableSignatorySigner,
          [
            arweaveTxIds[1],
            signatories[0].unencryptedShardDoubleHash,
            (maximumRewrapInterval + time.duration.minutes(1)).toString(),
            (timestamp + 1).toString(),
          ],
          ["string", "bytes32", "uint256", "uint256"]
        );
        signatories[0].r = disagreeingSignature.r;
        signatories[0].s = disagreeingSignature.s;
        signatories[0].v = disagreeingSignature.v;
        const tx = vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: threshold,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("InvalidSignature");
      });
    });
  });

  describe("rewrapVault()", () => {
    context("Successful rewrap", () => {
      it("transfers protocol fees from the vaultOwner to the contract", async () => {
        const _shares = 5;
        const _threshold = 3;
        const archMinDiggingFee = toVault(8);

        const {
          viewStateFacet,
          totalProtocolFeesBeforeRewrap,
          vaultOwnerBalanceBeforeRewrap,
          vaultOwner,
          sarcoToken,
        } = await rewrapFixture({ shares: _shares, threshold: _threshold, archMinDiggingFee });

        const totalDiggingFees = BigNumber.from(_shares).mul(archMinDiggingFee);
        const protocolFee = await viewStateFacet.getProtocolFeeBasePercentage();
        const expectedTotalProtocolFees = totalDiggingFees.mul(protocolFee).div(100);
        const totalProtocolFeesAfterRewrap = await viewStateFacet.getTotalProtocolFees();

        // confirm that protocol fee amount is updated on the contract
        expect(totalProtocolFeesAfterRewrap.sub(totalProtocolFeesBeforeRewrap)).to.equal(
          expectedTotalProtocolFees
        );

        // confirm vaultOwners SARCO balance has been debited
        const vaultOwnerBalanceAfterRewrap = await sarcoToken.balanceOf(vaultOwner.address);
        expect(vaultOwnerBalanceAfterRewrap).to.equal(
          vaultOwnerBalanceBeforeRewrap.sub(totalDiggingFees).sub(expectedTotalProtocolFees)
        );
      });

      it("emits an event", async () => {
        const { tx, vaultOwnerFacet } = await rewrapFixture({ shares, threshold }, sarcoName);
        await expect(tx).to.emit(vaultOwnerFacet, "RewrapVault");
      });

      it("adds digging fees to the signatory's total digging fees paid", async () => {
        const {
          tx,
          signatories,
          viewStateFacet,
          sarcoId,
          vaultOwnerFacet,
          vaultOwner,
          newResurrectionTime,
        } = await rewrapFixture({ shares, threshold }, sarcoName);
        await tx;

        // Rewrap a second time
        await vaultOwnerFacet
          .connect(vaultOwner)
          .rewrapVault(sarcoId, newResurrectionTime + 604800);

        // Get an signatory's curse token id
        const oneSignatory = signatories[0];
        const archData = await viewStateFacet.getVaultSignatory(
          sarcoId,
          oneSignatory.archAddress
        );

        expect(ethers.utils.parseEther("20").eq(archData.diggingFeesPaid as BigNumber)).to.be.true;
      });
    });

    context("Failed rewrap", () => {
      it("should revert if the sender is not vaultOwner", async () => {
        const { vaultOwnerFacet, sarcoId } = await rewrapFixture(
          { shares, threshold, skipRewrap: true },
          sarcoName
        );

        const signers = await ethers.getSigners();

        // Define a new resurrection time one week in the future
        const newResurrectionTime = (await time.latest()) + time.duration.weeks(1);

        // Rewrap the sarcophagus
        const tx = vaultOwnerFacet
          .connect(signers[8])
          .rewrapVault(sarcoId, newResurrectionTime);

        await expect(tx).to.be.revertedWith("SenderNotvaultOwner");
      });

      it("should revert if the sarcophagus does not exist", async () => {
        const { vaultOwnerFacet, vaultOwner, newResurrectionTime } = await rewrapFixture(
          { shares, threshold, skipRewrap: true },
          sarcoName
        );
        const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

        // Rewrap the sarcophagus
        const tx = vaultOwnerFacet
          .connect(vaultOwner)
          .rewrapVault(falseIdentifier, newResurrectionTime);

        await expect(tx).to.be.revertedWith("VaultDoesNotExist");
      });

      it("should revert if the new resurrection time is not in the future", async () => {
        const { vaultOwnerFacet, sarcoId, vaultOwner } = await rewrapFixture(
          { shares, threshold, skipRewrap: true },
          sarcoName
        );

        // Define a new resurrection time not in the future
        const newResurrectionTime = (await time.latest()) - 1;

        // Rewrap the sarcophagus
        const tx = vaultOwnerFacet.connect(vaultOwner).rewrapVault(sarcoId, newResurrectionTime);

        await expect(tx).to.be.revertedWith("NewResurrectionTimeInPast");
      });

      it("should fail to rewrap a sarcophagus with a new resurrection time in excess of the maxRewrapInterval", async () => {
        const {
          sarcoId,
          vaultOwnerFacet,
          vaultOwner,
          signatories,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          resurrectionTime,
          timestamp,
        } = await createVaultFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        await vaultOwnerFacet.connect(vaultOwner).createVault(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            canBeTransferred: true,
            minShards: threshold,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );

        const tx = vaultOwnerFacet
          .connect(vaultOwner)
          .rewrapVault(
            sarcoId,
            (await time.latest()) + maximumRewrapInterval + time.duration.minutes(1)
          );

        await expect(tx).to.be.revertedWith("NewResurrectionTimeTooLarge");
      });
    });
  });

  describe("buryVault()", () => {
    context("Successful bury", () => {
      it("should set resurrection time to inifinity", async () => {
        const { viewStateFacet, sarcoId } = await buryFixture({ shares, threshold }, sarcoName);
        const sarcophagus = await viewStateFacet.getVault(sarcoId);

        expect(sarcophagus.resurrectionTime).to.equal(ethers.constants.MaxUint256);
      });

      it("should set the sarcophagus state to done", async () => {
        const { viewStateFacet, sarcoId } = await buryFixture({ shares, threshold }, sarcoName);

        const sarcophagus = await viewStateFacet.getVault(sarcoId);

        expect(sarcophagus.state).to.equal(VaultState.Done);
      });

      it("should free an signatory's bond", async () => {
        const {
          viewStateFacet,
          regularSignatory,
          regularSignatoryFreeBondBefore,
          regularSignatoryCursedBondBefore,
        } = await buryFixture({ shares, threshold }, sarcoName);

        // Get the free and cursed bond after bury
        const freeBondAfter = await viewStateFacet.getFreeBond(regularSignatory.archAddress);
        const cursedBondAfter = await viewStateFacet.getCursedBond(
          regularSignatory.archAddress
        );

        expect(freeBondAfter.toString()).to.equal(
          regularSignatoryFreeBondBefore
            .add(calculateCursedBond(regularSignatory.diggingFee))
            .toString()
        );

        expect(cursedBondAfter.toString()).to.equal(
          regularSignatoryCursedBondBefore
            .sub(calculateCursedBond(regularSignatory.diggingFee))
            .toString()
        );
      });

      it("should emit BuryVault()", async () => {
        const { tx, vaultOwnerFacet, sarcoId } = await buryFixture({ shares, threshold }, sarcoName);
        await expect(tx).to.emit(vaultOwnerFacet, "BuryVault").withArgs(sarcoId);
      });
    });

    context("Failed bury", () => {
      it("should revert if sender is not the vaultOwner", async () => {
        const { vaultOwnerFacet, sarcoId } = await buryFixture(
          { shares, threshold, skipBury: true },
          sarcoName
        );
        const signers = await ethers.getSigners();

        const tx = vaultOwnerFacet.connect(signers[9]).buryVault(sarcoId);

        await expect(tx).to.be.revertedWith("SenderNotvaultOwner");
      });

      it("should revert if the sarcophagus does not exist", async () => {
        const { vaultOwnerFacet, vaultOwner } = await buryFixture(
          { shares, threshold, skipBury: true, dontAwaitTransaction: true },
          sarcoName
        );

        const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

        const tx = vaultOwnerFacet.connect(vaultOwner).buryVault(falseIdentifier);

        await expect(tx).to.be.revertedWith("VaultDoesNotExist");
      });
    });
  });
});
