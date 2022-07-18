import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { SarcophagusState } from "../../types";
import { createSarcoFixture } from "../fixtures/create-sarco-fixture";
import { buryFixture } from "../fixtures/bury-fixture";
import { cancelSarcoFixture } from "../fixtures/cancel-sarco-fixture";
import { rewrapFixture } from "../fixtures/rewrap-fixture";
import { calculateCursedBond, sign, signMultiple } from "../utils/helpers";
import time from "../utils/time";

describe("Contract: EmbalmerFacet", () => {
  const shares = 5;
  const threshold = 3;
  const sarcoName = "test init";

  describe("initializeSarcophagus()", () => {
    context("Successful initialization", () => {
      it("should transfer fees in sarco token from the embalmer to the contract", async () => {
        const {
          sarcoToken,
          embalmer,
          archaeologists,
          arweaveArchaeologist,
          embalmerBalanceBefore,
        } = await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        const embalmerBalanceAfter = await sarcoToken.balanceOf(embalmer.address);

        // Calculate the total fees:
        // The arweaver archaeologist's storage fee + all bounties + all digging
        // fees
        const totalFees = archaeologists
          .reduce(
            (acc, arch) => acc.add(calculateCursedBond(arch.diggingFee, arch.bounty)),
            BigNumber.from("0")
          )
          .add(arweaveArchaeologist.storageFee);

        expect(embalmerBalanceAfter.toString()).to.equal(
          embalmerBalanceBefore.sub(totalFees).toString()
        );
      });

      it("should emit InitializeSarcophagust()", async () => {
        const { embalmerFacet, initializeTx } = await createSarcoFixture(
          { shares, threshold, skipFinalize: true },
          sarcoName
        );

        expect(initializeTx).to.emit(embalmerFacet, "InitializeSarcophagus");
      });

      it("should set a maximum resurrection interval", async () => {
        const { sarcoId, viewStateFacet } = await createSarcoFixture(
          { shares, threshold, skipFinalize: true },
          sarcoName
        );

        const sarco = await viewStateFacet.getSarcophagus(sarcoId);
        expect(sarco.maxResurrectionInterval.toString()).to.eq(time.duration.weeks(1).toString());
      });
    });

    context("Failed initialization", () => {
      it("should revert when creating a sarcophagus that already exists", async () => {
        const {
          initializeTx: firstInitializeTx,
          finalizeTx,
          embalmer,
          embalmerFacet,
          sarcoId,
          archaeologists,
          arweaveArchaeologist,
          recipient,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, sarcoName);

        (await firstInitializeTx)?.wait();
        (await finalizeTx)?.wait();

        // Try to create the same sarcophagus again
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            sarcoName,
            archaeologists,
            arweaveArchaeologist.signer.address,
            recipient.address,
            resurrectionTime,
            time.duration.weeks(1),
            true,
            threshold
          );

        await expect(tx).to.be.revertedWith("SarcophagusAlreadyExists");
      });

      it("should revert if the resurrection time is not in the future", async () => {
        const {
          sarcoId,
          embalmerFacet,
          embalmer,
          archaeologists,
          arweaveArchaeologist,
          recipient,
        } = await createSarcoFixture({ shares, threshold, skipInitialize: true }, sarcoName);

        // Initialise the sarco with resurrection time 1 second in past
        const resurrectionTime = (await time.latest()) - 1;
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            sarcoName,
            archaeologists,
            arweaveArchaeologist.archAddress,
            recipient.address,
            resurrectionTime,
            time.duration.weeks(1),
            true,
            threshold
          );

        await expect(tx).to.be.revertedWith("ResurrectionTimeInPast");
      });

      it("should revert if maxResurrectionInterval is 0", async () => {
        const { initializeTx } = await createSarcoFixture(
          { shares, threshold, skipFinalize: true, dontAwaitInitTx: true },
          sarcoName,
          0
        );

        await expect(initializeTx).to.be.revertedWith("MaxResurrectionIntervalIsZero");
      });

      it("should revert if no archaeologists are provided", async () => {
        const { sarcoId, embalmerFacet, embalmer, arweaveArchaeologist, recipient } =
          await createSarcoFixture({ shares, threshold, skipInitialize: true }, sarcoName);

        // Initialise the sarco without archaeologists
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            sarcoName,
            [],
            arweaveArchaeologist.archAddress,
            recipient.address,
            (await time.latest()) + 100,
            time.duration.weeks(1),
            true,
            threshold
          );

        await expect(tx).to.be.revertedWith("NoArchaeologistsProvided");
      });

      it("should revert if the list of archaeologists is not unique", async () => {
        const {
          sarcoId,
          archaeologists,
          embalmerFacet,
          embalmer,
          arweaveArchaeologist,
          recipient,
        } = await createSarcoFixture({ shares, threshold, skipInitialize: true }, sarcoName);

        const nonUniqueArchaeologists = archaeologists.slice();
        nonUniqueArchaeologists.pop();
        const firstArchaeologist = archaeologists[0];
        nonUniqueArchaeologists.push(firstArchaeologist);

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            sarcoName,
            nonUniqueArchaeologists,
            arweaveArchaeologist.archAddress,
            recipient.address,
            (await time.latest()) + 100,
            time.duration.weeks(1),
            true,
            threshold
          );

        await expect(tx).to.be.revertedWith("ArchaeologistListNotUnique");
      });

      it("should revert if minShards is greater than the number of archaeologists", async () => {
        const {
          sarcoId,
          archaeologists,
          embalmerFacet,
          embalmer,
          arweaveArchaeologist,
          recipient,
        } = await createSarcoFixture({ shares, threshold, skipInitialize: true }, sarcoName);

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            sarcoName,
            archaeologists,
            arweaveArchaeologist.archAddress,
            recipient.address,
            (await time.latest()) + 100,
            time.duration.weeks(1),
            true,
            archaeologists.length + 1
          );

        await expect(tx).to.be.revertedWith("MinShardsGreaterThanArchaeologists");
      });

      it("should revert if minShards is 0", async () => {
        const {
          sarcoId,
          archaeologists,
          embalmerFacet,
          embalmer,
          arweaveArchaeologist,
          recipient,
        } = await createSarcoFixture({ shares, threshold, skipInitialize: true }, sarcoName);

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            sarcoName,
            archaeologists,
            arweaveArchaeologist.archAddress,
            recipient.address,
            (await time.latest()) + 100,
            time.duration.weeks(1),
            true,
            0
          );

        await expect(tx).to.be.revertedWith("MinShardsZero");
      });

      it("should revert if the arweave archaeologist is not included in the list of archaeologists", async () => {
        const { sarcoId, archaeologists, embalmerFacet, embalmer, recipient } =
          await createSarcoFixture({ shares, threshold, skipInitialize: true }, sarcoName);

        const signers = await ethers.getSigners();

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            sarcoName,
            archaeologists,
            signers[9].address,
            recipient.address,
            (await time.latest()) + 100,
            time.duration.weeks(1),
            true,
            threshold
          );

        await expect(tx).to.be.revertedWith("ArweaveArchaeologistNotInList");
      });
    });
  });

  describe("finalizeSarcophagus()", () => {
    context("Successful finalization", () => {
      it("should store the arweave transaction id", async () => {
        const { sarcoId, viewStateFacet, arweaveTxId } = await createSarcoFixture(
          { shares, threshold },
          sarcoName
        );

        const sarcophagusStored = await viewStateFacet.getSarcophagus(sarcoId);
        expect(sarcophagusStored.arweaveTxIds).to.contain(arweaveTxId);
      });

      it("should lock up an archaeologist's free bond", async () => {
        const {
          sarcoId,
          viewStateFacet,
          signatures,
          arweaveSignature,
          arweaveTxId,
          embalmerFacet,
          embalmer,
          archaeologists,
        } = await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        const regularArchaeologist = archaeologists[1];

        const archaeologistFreeBondBefore = await viewStateFacet.getFreeBond(
          regularArchaeologist.archAddress
        );
        const archaeologistCursedBondBefore = await viewStateFacet.getCursedBond(
          regularArchaeologist.archAddress
        );

        await embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(sarcoId, signatures.slice(1), arweaveSignature, arweaveTxId);

        const archaeologistFreeBondAfter = await viewStateFacet.getFreeBond(
          regularArchaeologist.archAddress
        );
        const archaeologistCursedBondAfter = await viewStateFacet.getCursedBond(
          regularArchaeologist.archAddress
        );

        const bondAmount = calculateCursedBond(
          regularArchaeologist.diggingFee,
          regularArchaeologist.bounty
        );

        // Check that the archaeologist's free bond afterward has descreased by the bond amount
        expect(archaeologistFreeBondAfter).to.equal(archaeologistFreeBondBefore.sub(bondAmount));

        // Check that the archaeologist's cursed bond has increased by the bond amount
        expect(archaeologistCursedBondAfter).to.equal(
          archaeologistCursedBondBefore.add(bondAmount)
        );
      });

      it("should lock up the arweave archaeologist's free bond", async () => {
        const {
          sarcoId,
          viewStateFacet,
          signatures,
          arweaveSignature,
          arweaveTxId,
          arweaveArchaeologist,
          embalmerFacet,
          embalmer,
        } = await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        const arweaveArchFreeBondBefore = await viewStateFacet.getFreeBond(
          arweaveArchaeologist.archAddress
        );
        const arweaveArchCursedBondBefore = await viewStateFacet.getCursedBond(
          arweaveArchaeologist.archAddress
        );

        await embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(sarcoId, signatures.slice(1), arweaveSignature, arweaveTxId);

        const arweaveArchFreeBondAfter = await viewStateFacet.getFreeBond(
          arweaveArchaeologist.archAddress
        );
        const arweaveArchCursedBondAfter = await viewStateFacet.getCursedBond(
          arweaveArchaeologist.archAddress
        );

        const bondAmount = calculateCursedBond(
          arweaveArchaeologist.diggingFee,
          arweaveArchaeologist.bounty
        );

        // Check that the arweave archaeologist's free bond has decreased by the bond amount
        expect(arweaveArchFreeBondAfter).to.equal(arweaveArchFreeBondBefore.sub(bondAmount));

        // Check that the arweave archaeologist's cursed bond has increased by the bond amount
        expect(arweaveArchCursedBondAfter).to.equal(arweaveArchCursedBondBefore.add(bondAmount));
      });

      it("should emit FinalizeSarcophagus()", async () => {
        const { finalizeTx, embalmerFacet } = await createSarcoFixture(
          { shares, threshold },
          sarcoName
        );

        expect(finalizeTx).to.emit(embalmerFacet, "FinalizeSarcophagus");
      });
    });

    context("General reverts", () => {
      it("should revert if the sarcophagus does not exist", async () => {
        const { signatures, arweaveSignature, arweaveTxId, embalmerFacet, embalmer } =
          await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        // Make a fake identifier
        const invalidSarcoId = solidityKeccak256(["string"], ["SomeFakeIdentifier"]);

        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(invalidSarcoId, signatures, arweaveSignature, arweaveTxId);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the embalmer is not making the transaction", async () => {
        const { sarcoId, signatures, arweaveSignature, arweaveTxId, embalmerFacet } =
          await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        const signers = await ethers.getSigners();

        const tx = embalmerFacet
          .connect(signers[9])
          .finalizeSarcophagus(sarcoId, signatures, arweaveSignature, arweaveTxId);

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus has already been finalized", async () => {
        const { sarcoId, signatures, arweaveSignature, arweaveTxId, embalmerFacet, embalmer } =
          await createSarcoFixture({ shares, threshold }, sarcoName);

        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(sarcoId, signatures, arweaveSignature, arweaveTxId);

        await expect(tx).to.be.revertedWith("SarcophagusAlreadyFinalized");
      });

      it("should revert if the provided arweave transaction id is empty", async () => {
        const { sarcoId, embalmer, signatures, arweaveSignature, embalmerFacet } =
          await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(sarcoId, signatures, arweaveSignature, "");

        await expect(tx).to.be.revertedWith("ArweaveTxIdEmpty");
      });
    });

    context("Signature reverts", () => {
      it("should revert if the incorrect number of archaeologists' signatures were provided", async () => {
        const { sarcoId, embalmer, signatures, arweaveSignature, arweaveTxId, embalmerFacet } =
          await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        const newSignatures = signatures.slice();
        newSignatures.push(signatures[0]);

        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(sarcoId, newSignatures, arweaveSignature, arweaveTxId);

        await expect(tx).to.be.revertedWith("IncorrectNumberOfArchaeologistSignatures");
      });

      it("should revert if there are duplicate signatures", async () => {
        const { sarcoId, embalmer, signatures, arweaveSignature, arweaveTxId, embalmerFacet } =
          await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        // Make the second signature the same as the first
        const newSignatures = signatures.slice(1);
        newSignatures[1] = newSignatures[0];

        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(sarcoId, newSignatures, arweaveSignature, arweaveTxId);

        await expect(tx).to.be.revertedWith("SignatureListNotUnique");
      });

      it("should revert if any signature provided by a regular archaeologist is from the wrong archaeologist", async () => {
        const {
          sarcoId,
          embalmer,
          arweaveSignature,
          archaeologists,
          arweaveArchaeologist,
          arweaveTxId,
          embalmerFacet,
        } = await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        const signers = await ethers.getSigners();

        // Get a false signer
        const falseSigner = signers[9];

        // Replace the last signer in the list of signers with falseSigner
        const newSigners = archaeologists
          .filter(x => x.archAddress !== arweaveArchaeologist.archAddress)
          .map(x => x.signer);

        newSigners[newSigners.length - 1] = falseSigner;

        const newSignatures = await signMultiple(newSigners, sarcoId);

        // Finalize the sarcophagus with the new identifier
        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(sarcoId, newSignatures, arweaveSignature, arweaveTxId);

        await expect(tx).to.be.revertedWith("ArchaeologistNotOnSarcophagus");
      });

      it("should revert if any signature provided by a regular archaeologist is not of the sarcophagus identifier", async () => {
        const {
          sarcoId,
          embalmer,
          signatures,
          arweaveSignature,
          archaeologists,
          arweaveTxId,
          embalmerFacet,
        } = await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        // Create a false identifier
        const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

        // Use a correct archaeologist to sign a false identifier
        const falseSignature = await sign(archaeologists[2].signer, falseIdentifier, "bytes32");

        // Add the correct archaeologist account
        const falseSigWithAccount = { ...falseSignature, account: archaeologists[2].archAddress };

        // Copy the signatures array
        const newSignatures = signatures.slice(1);

        // Replace the second (arweave archaeologist is the first) signature in
        // the list of newSignatures with the false signature
        newSignatures[1] = falseSigWithAccount;

        // Finalize the sarcophagus with the new identifier where one of the signatures is incorrect
        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(sarcoId, newSignatures, arweaveSignature, arweaveTxId);

        await expect(tx).to.be.revertedWith("SignatureFromWrongAccount");
      });

      it("should revert if the arweave archaeologist's signature is from the wrong archaeologist", async () => {
        const { sarcoId, embalmer, signatures, arweaveTxId, embalmerFacet } =
          await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        const signers = await ethers.getSigners();

        // Sign the arweaveTxId with the wrong archaeologist
        const falseArweaveArch = signers[6];
        const falseArweaveSignature = await sign(falseArweaveArch, arweaveTxId, "string");

        // Finalize the sarcophagus where the arweaveSignature is signed by the wrong signer
        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(sarcoId, signatures.slice(1), falseArweaveSignature, arweaveTxId);

        await expect(tx).to.be.revertedWith("SignatureFromWrongAccount");
      });

      it("should revert if the arweave archaeologist's signature is not a signature of the arweave transaction id", async () => {
        const { sarcoId, embalmer, signatures, arweaveTxId, embalmerFacet, arweaveArchaeologist } =
          await createSarcoFixture({ shares, threshold, skipFinalize: true }, sarcoName);

        // Use the correct arweave archaeologist to sign a false arweaveTxId
        const falseArweaveSignature = await sign(
          arweaveArchaeologist.signer,
          "falseArweaveTxId",
          "string"
        );

        // Finalize the sarcophagus where the signature is of the wrong data
        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(sarcoId, signatures.slice(1), falseArweaveSignature, arweaveTxId);

        // Note that it's not possible to get a custom error for this case
        // because ecrecover always returns a valid address.
        await expect(tx).to.be.revertedWith("SignatureFromWrongAccount");
      });
    });
  });

  describe("rewrapSarcophagus()", () => {
    context("Successful rewrap", () => {
      it("should store the new resurrection time", async () => {
        const { viewStateFacet, sarcoId, newResurrectionTime } = await rewrapFixture(
          { shares, threshold },
          sarcoName
        );
        const sarcophagusStored = await viewStateFacet.getSarcophagus(sarcoId);

        expect(sarcophagusStored.resurrectionTime).to.equal(newResurrectionTime.toString());
      });

      it.skip("should store the new resurrection window", async () => {
        const { viewStateFacet, sarcoId, oldResurrectionWindow } = await rewrapFixture(
          { shares, threshold },
          sarcoName
        );

        const sarcophagusStoredAfter = await viewStateFacet.getSarcophagus(sarcoId);

        expect(sarcophagusStoredAfter.resurrectionWindow).to.not.equal(oldResurrectionWindow);
      });

      it("should transfer the digging fee sum plus the protocol fee from the embalmer to the contract", async () => {
        const { archaeologists, sarcoToken, embalmer, embalmerBalanceBefore } = await rewrapFixture(
          { shares, threshold },
          sarcoName
        );

        // Get the embalmer's sarco balance after rewrap
        const embalmerSarcoBalanceAfter = await sarcoToken.balanceOf(embalmer.address);

        // Calculate the sum of digging fees from archaeologistFees
        const diggingFeeSum = archaeologists.reduce(
          (acc, arch) => acc.add(arch.diggingFee),
          BigNumber.from(0)
        );

        const protocolFee = process.env.PROTOCOL_FEE || "0";

        const expectedFees = diggingFeeSum.add(BigNumber.from(protocolFee));

        // Check that the difference in balances is equal to the sum of digging fees
        expect(embalmerBalanceBefore.sub(embalmerSarcoBalanceAfter)).to.equal(expectedFees);
      });

      it("should collect protocol fees", async () => {
        const { viewStateFacet, totalProtocolFees } = await rewrapFixture(
          { shares, threshold },
          sarcoName
        );

        // Get the protocol fee amount
        const protocolFee = await viewStateFacet.getProtocolFeeAmount();

        // Get the total protocol fees after rewrap
        const totalProtocolFeesAfter = await viewStateFacet.getTotalProtocolFees();

        // Check that the difference in total protocol fees is equal to the protocol fee amount
        expect(totalProtocolFeesAfter.sub(totalProtocolFees)).to.equal(protocolFee);
      });

      it("should emit an event", async () => {
        const { tx, embalmerFacet } = await rewrapFixture({ shares, threshold }, sarcoName);
        expect(tx).to.emit(embalmerFacet, "RewrapSarcophagus");
      });
    });

    context("Failed rewrap", () => {
      it("should revert if the sender is not embalmer", async () => {
        const { embalmerFacet, sarcoId } = await rewrapFixture(
          { shares, threshold, skipRewrap: true },
          sarcoName
        );

        const signers = await ethers.getSigners();

        // Define a new resurrection time one week in the future
        const newResurrectionTime = (await time.latest()) + time.duration.weeks(1);

        // Rewrap the sarcophagus
        const tx = embalmerFacet
          .connect(signers[8])
          .rewrapSarcophagus(sarcoId, newResurrectionTime);

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus does not exist", async () => {
        const { embalmerFacet, embalmer, newResurrectionTime } = await rewrapFixture(
          { shares, threshold, skipRewrap: true },
          sarcoName
        );
        const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

        // Rewrap the sarcophagus
        const tx = embalmerFacet
          .connect(embalmer)
          .rewrapSarcophagus(falseIdentifier, newResurrectionTime);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sarcophagus is not finalized", async () => {
        // Use the fixture for initializeSarcophagus just this once so we can
        // properly initialize the sarcophagus
        const { tx } = await rewrapFixture(
          { shares, threshold, skipFinaliseSarco: true, dontAwaitTransaction: true },
          sarcoName
        );

        await expect(tx).to.be.revertedWith("SarcophagusNotFinalized");
      });

      it("should revert if the new resurrection time is not in the future", async () => {
        const { embalmerFacet, sarcoId, embalmer } = await rewrapFixture(
          { shares, threshold, skipRewrap: true },
          sarcoName
        );

        // Define a new resurrection time not in the future
        const newResurrectionTime = (await time.latest()) - 1;

        // Rewrap the sarcophagus
        const tx = embalmerFacet.connect(embalmer).rewrapSarcophagus(sarcoId, newResurrectionTime);

        await expect(tx).to.be.revertedWith("NewResurrectionTimeInPast");
      });

      it("should revert if the new resurrection time is further in the future than maxResurrectionTime allows", async () => {
        const { tx } = await rewrapFixture(
          { shares, threshold, dontAwaitTransaction: true },
          sarcoName,
          // Add 60 seconds to known default maxResurrectionInterval (from rewrapFixture's createSarcoFixture)
          // of 1 week
          time.duration.weeks(1) + 60
        );

        await expect(tx).to.be.revertedWith("NewResurrectionTimeTooLarge");
      });
    });
  });

  describe("cancelSarcophagus()", () => {
    context("Successful cancel", () => {
      it("should set the sarcophagus state to done", async () => {
        const { viewStateFacet, sarcoId } = await cancelSarcoFixture(
          { shares, threshold },
          sarcoName
        );
        const sarcophagus = await viewStateFacet.getSarcophagus(sarcoId);

        expect(sarcophagus.state).to.equal(SarcophagusState.Done);
      });

      it("should transfer total fees back to the embalmer", async () => {
        const { sarcoToken, embalmer, embalmerBalanceBeforeCreate } = await cancelSarcoFixture(
          { shares, threshold },
          sarcoName
        );

        // Get the sarco balance of the embalmer after canceling the sarcophagus
        const embalmerBalanceAfter = await sarcoToken.balanceOf(embalmer.address);

        expect(embalmerBalanceAfter).to.equal(embalmerBalanceBeforeCreate);
      });

      it("should emit CancelSarcophagus()", async () => {
        const { tx, embalmerFacet, sarcoId } = await cancelSarcoFixture(
          { shares, threshold },
          sarcoName
        );

        expect(tx).emit(embalmerFacet, "CancelSarcophagus").withArgs(sarcoId);
      });
    });

    context("Failed cancel", () => {
      it("should revert if the sender is not the embalmer", async () => {
        const { embalmerFacet, archaeologists, sarcoId } = await cancelSarcoFixture(
          { shares, threshold, skipCancel: true },
          sarcoName
        );

        const tx = embalmerFacet.connect(archaeologists[0].signer).cancelSarcophagus(sarcoId);

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus does not exist", async () => {
        const { embalmerFacet, embalmer } = await cancelSarcoFixture(
          { shares, threshold, skipCancel: true },
          sarcoName
        );
        const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

        const tx = embalmerFacet.connect(embalmer).cancelSarcophagus(falseIdentifier);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sarcohaphagus is already finalized", async () => {
        const { tx } = await cancelSarcoFixture(
          { shares, threshold, doFinalize: true, dontAwaitTransaction: true },
          sarcoName
        );
        await expect(tx).to.be.revertedWith("SarcophagusAlreadyFinalized");
      });
    });
  });

  describe("burySarcophagus()", () => {
    context("Successful bury", () => {
      it("should set resurrection time to inifinity", async () => {
        const { viewStateFacet, sarcoId } = await buryFixture({ shares, threshold }, sarcoName);
        const sarcophagus = await viewStateFacet.getSarcophagus(sarcoId);

        expect(sarcophagus.resurrectionTime).to.equal(ethers.constants.MaxUint256);
      });

      it("should set the sarcophagus state to done", async () => {
        const { viewStateFacet, sarcoId } = await buryFixture({ shares, threshold }, sarcoName);

        const sarcophagus = await viewStateFacet.getSarcophagus(sarcoId);

        expect(sarcophagus.state).to.equal(SarcophagusState.Done);
      });

      it("should free an archaeologist's bond", async () => {
        const {
          viewStateFacet,
          regularArchaeologist,
          regularArchaeologistFreeBondBefore,
          regularArchaeologistCursedBondBefore,
        } = await buryFixture({ shares, threshold }, sarcoName);

        // Get the free and cursed bond after bury
        const freeBondAfter = await viewStateFacet.getFreeBond(regularArchaeologist.archAddress);
        const cursedBondAfter = await viewStateFacet.getCursedBond(
          regularArchaeologist.archAddress
        );

        expect(freeBondAfter.toString()).to.equal(
          regularArchaeologistFreeBondBefore
            .add(calculateCursedBond(regularArchaeologist.diggingFee, regularArchaeologist.bounty))
            .toString()
        );

        expect(cursedBondAfter.toString()).to.equal(
          regularArchaeologistCursedBondBefore
            .sub(calculateCursedBond(regularArchaeologist.diggingFee, regularArchaeologist.bounty))
            .toString()
        );
      });

      it("should transfer the bounty back to the embalmer", async () => {
        const { sarcoToken, embalmer, archaeologists, embalmerBalanceBeforeBury } =
          await buryFixture({ shares, threshold }, sarcoName);

        // Get the archaeologist sarco balance after bury
        const embalmerBalanceAfter = await sarcoToken.balanceOf(embalmer.address);

        // Add the bounties in archaeologist fees
        const totalBounty = archaeologists.reduce(
          (acc, arch) => acc.add(arch.bounty),
          ethers.constants.Zero
        );

        // Check that the difference in balances is equal to the total bounty
        expect(embalmerBalanceAfter.sub(embalmerBalanceBeforeBury)).to.equal(totalBounty);
      });

      it("should emit BurySarcophagus()", async () => {
        const { tx, embalmerFacet, sarcoId } = await buryFixture({ shares, threshold }, sarcoName);
        expect(tx).to.emit(embalmerFacet, "BurySarcophagus").withArgs(sarcoId);
      });
    });

    context("Failed bury", () => {
      it("should revert if sender is not the embalmer", async () => {
        const { embalmerFacet, sarcoId } = await buryFixture(
          { shares, threshold, skipBury: true },
          sarcoName
        );
        const signers = await ethers.getSigners();

        const tx = embalmerFacet.connect(signers[9]).burySarcophagus(sarcoId);

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus does not exist", async () => {
        const { embalmerFacet, embalmer } = await buryFixture(
          { shares, threshold, skipBury: true, dontAwaitTransaction: true },
          sarcoName
        );

        const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

        const tx = embalmerFacet.connect(embalmer).burySarcophagus(falseIdentifier);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sarcophagus is not finalized", async () => {
        const { tx } = await buryFixture(
          { shares, threshold, skipFinalize: true, dontAwaitTransaction: true },
          sarcoName
        );

        await expect(tx).to.be.revertedWith("SarcophagusNotFinalized");
      });
    });
  });
});
