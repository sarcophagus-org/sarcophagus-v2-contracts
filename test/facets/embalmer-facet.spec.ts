import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { SarcophagusState } from "../../types";
import { failingBuryFixture } from "../fixtures/failing-bury-fixture";
import { failingCancelFixture } from "../fixtures/failing-cancel-fixture";
import { failingFinalizeSarcohpagusFixture } from "../fixtures/failing-finalize-sarcophagus-fixture";
import { failingInitializeSarcophagusFixture } from "../fixtures/failing-initialize-sarcophagus-fixture";
import { failingRewrapFixture } from "../fixtures/failing-rewrap-fixture";
import { successfulBuryFixture } from "../fixtures/successful-bury-fixture";
import { successfulCancelFixture } from "../fixtures/successful-cancel-fixture";
import { successfulFinalizeSarcohpagusFixture } from "../fixtures/successful-finalize-sarcophagus-fixture";
import { successfulInitializeSarcophagusFixture } from "../fixtures/successful-initialize-sarcophagus-fixture";
import { successfulRewrapFixture } from "../fixtures/successful-rewrap-fixture";
import { sign, signMultiple } from "../utils/helpers";

describe("Contract: EmbalmerFacet", () => {
  describe("initializeSarcophagus()", () => {
    context("Successful initialization", () => {
      it("should transfer fees in sarco token from the embalmer to the contract", async () => {
        const {
          sarcoToken,
          embalmer,
          archaeologists,
          arweaveArchaeologist,
          embalmerBalance,
        } = await successfulInitializeSarcophagusFixture();

        const embalmerBalanceAfter = await sarcoToken.balanceOf(
          embalmer.address
        );

        // Calculate the total fees:
        // The arweaver archaeologist's storage fee + all bounties + all digging
        // fees
        const totalFees = archaeologists
          .reduce(
            (acc, arch) => acc.add(arch.bounty).add(arch.diggingFee),
            BigNumber.from("0")
          )
          .add(arweaveArchaeologist.storageFee);

        expect(embalmerBalance.sub(embalmerBalanceAfter)).to.equal(
          BigNumber.from(totalFees)
        );
      });

      it("should emit an event on initialize", async () => {
        const { tx, embalmerFacet } =
          await successfulInitializeSarcophagusFixture();

        const receipt = await tx.wait();

        const events = receipt.events!;
        expect(events).to.not.be.undefined;

        // Check that the list of events includes an event that has an address
        // matching the embalmerFacet address
        expect(events.some((event) => event.address === embalmerFacet.address))
          .to.be.true;
      });
    });

    context("Failed initialization", () => {
      it("should revert when creating a sarcophagus that already exists", async () => {
        const {
          identifier,
          embalmerFacet,
          embalmer,
          archaeologists,
          arweaveArchaeologist,
          recipient,
          resurrectionTime,
          name,
          canBeTransferred,
          minShards,
        } = await failingInitializeSarcophagusFixture();

        // Create a sarcophagus as the embalmer
        await embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            name,
            identifier,
            archaeologists,
            arweaveArchaeologist.account,
            recipient.address,
            resurrectionTime,
            canBeTransferred,
            minShards
          );

        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            name,
            identifier,
            archaeologists,
            arweaveArchaeologist.account,
            recipient.address,
            resurrectionTime,
            canBeTransferred,
            minShards
          );

        // Try to create the same sarcophagus again
        await expect(tx).to.be.revertedWith("SarcophagusAlreadyExists");
      });

      it("should revert if the resurrection time is not in the future", async () => {
        const {
          identifier,
          embalmerFacet,
          embalmer,
          archaeologists,
          arweaveArchaeologist,
          recipient,
          name,
          canBeTransferred,
          minShards,
        } = await failingInitializeSarcophagusFixture();

        const resurrectionTime = BigNumber.from(
          Math.floor(Date.now() / 1000) - 1
        );

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            name,
            identifier,
            archaeologists,
            arweaveArchaeologist.account,
            recipient.address,
            resurrectionTime,
            canBeTransferred,
            minShards
          );

        await expect(tx).to.be.revertedWith("ResurrectionTimeInPast");
      });

      it("should revert if no archaeologists are provided", async () => {
        const {
          identifier,
          embalmerFacet,
          embalmer,
          arweaveArchaeologist,
          recipient,
          name,
          canBeTransferred,
          minShards,
          resurrectionTime,
        } = await failingInitializeSarcophagusFixture();

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            name,
            identifier,
            [],
            arweaveArchaeologist.account,
            recipient.address,
            resurrectionTime,
            canBeTransferred,
            minShards
          );

        await expect(tx).to.be.revertedWith("NoArchaeologistsProvided");
      });

      it("should revert if the list of archaeologists is not unique", async () => {
        const {
          identifier,
          embalmerFacet,
          embalmer,
          arweaveArchaeologist,
          recipient,
          name,
          canBeTransferred,
          minShards,
          resurrectionTime,
          archaeologists,
        } = await failingInitializeSarcophagusFixture();

        const nonUniqueArchaeologists = archaeologists.slice();
        nonUniqueArchaeologists.pop();
        const firstArchaeologist = archaeologists[0];
        nonUniqueArchaeologists.push(firstArchaeologist);

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            name,
            identifier,
            nonUniqueArchaeologists,
            arweaveArchaeologist.account,
            recipient.address,
            resurrectionTime,
            canBeTransferred,
            minShards
          );

        await expect(tx).to.be.revertedWith("ArchaeologistListNotUnique");
      });

      it("should revert if minShards is greater than the number of archaeologists", async () => {
        const {
          identifier,
          embalmerFacet,
          embalmer,
          arweaveArchaeologist,
          recipient,
          name,
          canBeTransferred,
          resurrectionTime,
          archaeologists,
        } = await failingInitializeSarcophagusFixture();

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            name,
            identifier,
            archaeologists,
            arweaveArchaeologist.account,
            recipient.address,
            resurrectionTime,
            canBeTransferred,
            10
          );

        await expect(tx).to.be.revertedWith(
          "MinShardsGreaterThanArchaeologists"
        );
      });

      it("should revert if minShards is 0", async () => {
        const {
          identifier,
          embalmerFacet,
          embalmer,
          arweaveArchaeologist,
          recipient,
          name,
          canBeTransferred,
          resurrectionTime,
          archaeologists,
        } = await failingInitializeSarcophagusFixture();

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            name,
            identifier,
            archaeologists,
            arweaveArchaeologist.account,
            recipient.address,
            resurrectionTime,
            canBeTransferred,
            0
          );

        await expect(tx).to.be.revertedWith("MinShardsZero");
      });

      it("should revert if the arweave archaeologist is not included in the list of archaeologists", async () => {
        const {
          identifier,
          embalmerFacet,
          embalmer,
          recipient,
          name,
          canBeTransferred,
          resurrectionTime,
          archaeologists,
          minShards,
        } = await failingInitializeSarcophagusFixture();

        const signers = await ethers.getSigners();

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet
          .connect(embalmer)
          .initializeSarcophagus(
            name,
            identifier,
            archaeologists,
            signers[9].address,
            recipient.address,
            resurrectionTime,
            canBeTransferred,
            minShards
          );

        await expect(tx).to.be.revertedWith("ArweaveArchaeologistNotInList");
      });
    });
  });

  describe("finalizeSarcophagus()", () => {
    context("Successful finalization", () => {
      it("should store the arweave transaction id", async () => {
        const { identifier, viewStateFacet, arweaveTxId } =
          await successfulFinalizeSarcohpagusFixture();

        const sarcophagusStored = await viewStateFacet.getSarcophagus(
          identifier
        );
        expect(sarcophagusStored.arweaveTxIds).to.contain(arweaveTxId);
      });

      it("should transfer the storage fee to the arweave archaeologist", async () => {
        const { sarcoToken, arweaveArchaeologist, arweaveArchBalance } =
          await successfulFinalizeSarcohpagusFixture();

        // Get the arweave archaeologist's sarco token balance after finalization
        const arweaveArchBalanceAfter = await sarcoToken.balanceOf(
          arweaveArchaeologist.account
        );

        expect(arweaveArchBalanceAfter.sub(arweaveArchBalance)).to.equal(
          arweaveArchaeologist.storageFee
        );
      });

      it("should lock up an archaeologist's free bond", async () => {
        const {
          viewStateFacet,
          regularArchaeologist,
          regularArchaeologistFreeBond,
          regularArchaeologistCursedBond,
        } = await successfulFinalizeSarcohpagusFixture();

        const bondAmount = regularArchaeologist.diggingFee.add(
          regularArchaeologist.bounty
        );

        const archaeologistFreeBondAfter = await viewStateFacet.getFreeBond(
          regularArchaeologist.account
        );

        const archaeologistCursedBondAfter = await viewStateFacet.getCursedBond(
          regularArchaeologist.account
        );

        // Check that the archaeologist's free bond afterward has descreased by the bond amount
        expect(regularArchaeologistFreeBond.sub(bondAmount)).to.equal(
          archaeologistFreeBondAfter
        );

        // Check that the archaeologist's cursed bond has increased by the bond amount
        expect(regularArchaeologistCursedBond.add(bondAmount)).to.equal(
          archaeologistCursedBondAfter
        );
      });

      it("should lock up the arweave archaeologist's free bond", async () => {
        const {
          viewStateFacet,
          arweaveArchaeologist,
          arweaveArchaeologistFreeBond,
          arweaveArchaeologistCursedBond,
        } = await successfulFinalizeSarcohpagusFixture();

        const arweaveArchFreeBondAfter = await viewStateFacet.getFreeBond(
          arweaveArchaeologist.account
        );

        const arweaveArchCursedBondAfter = await viewStateFacet.getCursedBond(
          arweaveArchaeologist.account
        );

        const bondAmount = arweaveArchaeologist.diggingFee.add(
          arweaveArchaeologist.bounty
        );

        // Check that the arweave archaeologist's free bond has decreased by the bond amount
        expect(arweaveArchaeologistFreeBond.sub(bondAmount)).to.equal(
          arweaveArchFreeBondAfter
        );

        // Check that the arweave archaeologist's cursed bond has increased by the bond amount
        expect(arweaveArchaeologistCursedBond.add(bondAmount)).to.equal(
          arweaveArchCursedBondAfter
        );
      });

      it("should emit an event", async () => {
        const { tx, embalmerFacet } =
          await successfulFinalizeSarcohpagusFixture();

        const receipt = await tx.wait();

        const events = receipt.events!;
        expect(events).to.not.be.undefined;

        // Check that the list of events includes an event that has an address
        // matching the embalmerFacet address
        expect(events.some((event) => event.address === embalmerFacet.address))
          .to.be.true;
      });
    });

    context("General reverts", () => {
      it("should revert if the sarcophagus does not exist", async () => {
        const {
          archaeologists,
          embalmerFacet,
          embalmer,
          arweaveArchaeologistSignature,
          arweaveTxId,
        } = await failingFinalizeSarcohpagusFixture();

        // Make a fake identifier
        const identifier = solidityKeccak256(
          ["string"],
          ["SomeFakeIdentifier"]
        );

        // Each archaeologist signs the fake identifier
        const signatures = await signMultiple(
          archaeologists.map((x) => x.signer),
          identifier
        );

        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            signatures,
            arweaveArchaeologistSignature,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the embalmer is not making the transaction", async () => {
        const {
          identifier,
          signatures,
          embalmerFacet,
          arweaveArchaeologistSignature,
          arweaveTxId,
        } = await failingFinalizeSarcohpagusFixture();

        const signers = await ethers.getSigners();

        const tx = embalmerFacet
          .connect(signers[9])
          .finalizeSarcophagus(
            identifier,
            signatures,
            arweaveArchaeologistSignature,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus has already been finalized", async () => {
        const {
          identifier,
          signatures,
          embalmerFacet,
          arweaveArchaeologistSignature,
          arweaveTxId,
          embalmer,
        } = await failingFinalizeSarcohpagusFixture();

        await embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            signatures,
            arweaveArchaeologistSignature,
            arweaveTxId
          );

        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            signatures,
            arweaveArchaeologistSignature,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("SarcophagusAlreadyFinalized");
      });

      it("should revert if the provided arweave transaction id is empty", async () => {
        const {
          identifier,
          signatures,
          embalmerFacet,
          arweaveArchaeologistSignature,
          embalmer,
        } = await failingFinalizeSarcohpagusFixture();

        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            signatures,
            arweaveArchaeologistSignature,
            ""
          );

        await expect(tx).to.be.revertedWith("ArweaveTxIdEmpty");
      });
    });

    context("Signature reverts", () => {
      it("should revert if the incorrect number of archaeologists' signatures were provided", async () => {
        const {
          identifier,
          signatures,
          embalmerFacet,
          arweaveArchaeologistSignature,
          arweaveTxId,
          embalmer,
        } = await failingFinalizeSarcohpagusFixture();

        const newSignatures = signatures.slice();
        newSignatures.push(signatures[0]);

        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            newSignatures,
            arweaveArchaeologistSignature,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith(
          "IncorrectNumberOfArchaeologistSignatures"
        );
      });

      it("should revert if there are duplicate signatures", async () => {
        const {
          identifier,
          signatures,
          embalmerFacet,
          arweaveArchaeologistSignature,
          arweaveTxId,
          embalmer,
        } = await failingFinalizeSarcohpagusFixture();

        // Make the second signature the same as the first
        const newSignatures = signatures.slice();
        newSignatures[1] = newSignatures[0];

        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            newSignatures,
            arweaveArchaeologistSignature,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("SignatureListNotUnique");
      });

      it("should revert if any signature provided by a regular archaeologist is from the wrong archaeologist", async () => {
        const {
          identifier,
          archaeologists,
          embalmerFacet,
          arweaveArchaeologistSignature,
          arweaveTxId,
          embalmer,
          arweaveArchaeologist,
        } = await failingFinalizeSarcohpagusFixture();

        const signers = await ethers.getSigners();

        // Get a false signer
        const falseSigner = signers[9];

        // Replace the last signer in the list of signers with falseSigner
        const newSigners = archaeologists
          .filter((x) => x.account !== arweaveArchaeologist.account)
          .map((x) => x.signer);

        newSigners[newSigners.length - 1] = falseSigner;

        const newSignatures = await signMultiple(newSigners, identifier);

        // Finalize the sarcophagus with the new identifier
        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            newSignatures,
            arweaveArchaeologistSignature,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("ArchaeologistNotOnSarcophagus");
      });

      it("should revert if any signature provided by a regular archaeologist is not of the sarcophagus identifier", async () => {
        const {
          identifier,
          archaeologists,
          embalmerFacet,
          arweaveArchaeologistSignature,
          signatures,
          arweaveTxId,
          embalmer,
        } = await failingFinalizeSarcohpagusFixture();

        // Create a false identifier
        const falseIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["falseIdentifier"]
        );

        // Use a correct archaeologist to sign a false identifier
        const falseSignature = await sign(
          archaeologists[2].signer,
          falseIdentifier,
          "bytes32"
        );

        // Add the correct archaeologist account
        const falseSigWithAccount = Object.assign(falseSignature, {
          account: archaeologists[2].account,
        });

        // Copy the signatures array
        const newSignatures = signatures.slice();

        // Replace the second (arweave archaeologist is the first) signature in
        // the list of newSignatures with the false signature
        newSignatures[1] = falseSigWithAccount;

        // Finalize the sarcophagus with the new identifier where one of the signatures is incorrect
        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            newSignatures,
            arweaveArchaeologistSignature,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("SignatureFromWrongAccount");
      });

      it("should revert if the arweave archaeologist's signature is from the wrong archaeologist", async () => {
        const { identifier, embalmerFacet, signatures, arweaveTxId, embalmer } =
          await failingFinalizeSarcohpagusFixture();

        const signers = await ethers.getSigners();

        // Sign the arweaveTxId with the wrong archaeologist
        const falseArweaveArch = signers[6];
        const falseArweaveSignature = await sign(
          falseArweaveArch,
          arweaveTxId,
          "string"
        );

        // Finalize the sarcophagus where the arweaveSignature is signed by the wrong signer
        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            signatures,
            falseArweaveSignature,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("SignatureFromWrongAccount");
      });

      it("should revert if the arweave archaeologist's signature is not a signature of the arweave transaction id", async () => {
        const {
          identifier,
          embalmerFacet,
          signatures,
          arweaveTxId,
          arweaveArchaeologist,
          embalmer,
        } = await failingFinalizeSarcohpagusFixture();

        // Use the correct arweave archaeologist to sign a false arweaveTxId
        const falseArweaveSignature = await sign(
          arweaveArchaeologist.signer,
          "falseArweaveTxId",
          "string"
        );

        // Finalize the sarcophagus where the signature is of the wrong data
        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            signatures,
            falseArweaveSignature,
            arweaveTxId
          );

        // Note that it's not possible to get a custom error for this case
        // because ecrecover always returns a valid address.
        await expect(tx).to.be.revertedWith("SignatureFromWrongAccount");
      });
    });
  });

  describe("rewrapSarcophagus()", () => {
    context("Successful rewrap", () => {
      it("should store the new resurrection time", async () => {
        const { viewStateFacet, identifier, newResurrectionTime } =
          await successfulRewrapFixture();
        const sarcophagusStored = await viewStateFacet.getSarcophagus(
          identifier
        );

        expect(sarcophagusStored.resurrectionTime).to.equal(
          newResurrectionTime.toString()
        );
      });

      it("should store the new resurrection window", async () => {
        const { viewStateFacet, identifier, oldResurrectionWindow } =
          await successfulRewrapFixture();

        const sarcophagusStoredAfter = await viewStateFacet.getSarcophagus(
          identifier
        );

        expect(sarcophagusStoredAfter.resurrectionWindow).to.not.equal(
          oldResurrectionWindow
        );
      });

      it("should transfer the digging fee sum plus the protocol fee from the embalmer to the contract", async () => {
        const { archaeologists, sarcoToken, embalmer, embalmerBalance } =
          await successfulRewrapFixture();

        // Get the embalmer's sarco balance after rewrap
        const embalmerSarcoBalanceAfter = await sarcoToken.balanceOf(
          embalmer.address
        );

        // Calculate the sum of digging fees from archaeologistFees
        const diggingFeeSum = archaeologists.reduce(
          (acc, arch) => acc.add(arch.diggingFee),
          BigNumber.from(0)
        );

        const protocolFee = process.env.PROTOCOL_FEE || "0";

        const expectedFees = diggingFeeSum.add(BigNumber.from(protocolFee));

        // Check that the difference in balances is equal to the sum of digging fees
        expect(embalmerBalance.sub(embalmerSarcoBalanceAfter)).to.equal(
          expectedFees
        );
      });

      it("should collect protocol fees", async () => {
        const {
          viewStateFacet,
          sarcoToken,
          diamond,
          totalProtocolFees,
          contractBalance,
        } = await successfulRewrapFixture();

        // Get the protocol fee amount
        const protocolFee = await viewStateFacet.getProtocolFeeAmount();

        // Get the total protocol fees after rewrap
        const totalProtocolFeesAfter =
          await viewStateFacet.getTotalProtocolFees();

        // Get the balance of the contract after rewrap
        const contractBalanceAfter = await sarcoToken.balanceOf(
          diamond.address
        );

        // Check that the difference in total protocol fees is equal to the protocol fee amount
        expect(totalProtocolFeesAfter.sub(totalProtocolFees)).to.equal(
          protocolFee
        );

        // Check that the difference in contract balance is equal to the protocol fee amount
        expect(contractBalanceAfter.sub(contractBalance).toString()).to.equal(
          protocolFee.toString()
        );
      });

      it("should emit an event", async () => {
        const { tx, embalmerFacet } = await successfulRewrapFixture();
        const receipt = await tx.wait();

        const events = receipt.events!;
        expect(events).to.not.be.undefined;

        // Check that the list of events includes an event that has an address
        // matching the embalmerFacet address
        expect(events.some((event) => event.address === embalmerFacet.address))
          .to.be.true;
      });
    });

    context("Failed rewrap", () => {
      it("should revert if the sender is not embalmer", async () => {
        const { embalmerFacet, identifier } = await failingRewrapFixture();

        const signers = await ethers.getSigners();
        // Define a new resurrection time one week in the future
        const newResurrectionTime = BigNumber.from(
          Date.now() + 60 * 60 * 24 * 7 * 1000
        );

        // Rewrap the sarcophagus
        const tx = embalmerFacet
          .connect(signers[8])
          .rewrapSarcophagus(identifier, newResurrectionTime);

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus does not exist", async () => {
        const { embalmerFacet, embalmer, newResurrectionTime } =
          await failingRewrapFixture();
        const falseIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["falseIdentifier"]
        );

        // Rewrap the sarcophagus
        const tx = embalmerFacet
          .connect(embalmer)
          .rewrapSarcophagus(falseIdentifier, newResurrectionTime);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sarcophagus is not finalized", async () => {
        // Use the fixture for initializeSarcophagus just this once so we can
        // properly initialize the sarcophagus
        const { embalmerFacet, identifier, embalmer } =
          await successfulInitializeSarcophagusFixture();

        // Define a new resurrection time one week in the future
        const newResurrectionTime = BigNumber.from(
          Date.now() + 60 * 60 * 24 * 7 * 1000
        );

        // Rewrap the sarcophagus
        const tx = embalmerFacet
          .connect(embalmer)
          .rewrapSarcophagus(identifier, newResurrectionTime);

        await expect(tx).to.be.revertedWith("SarcophagusNotFinalized");
      });

      it("should revert if the new resurrection time is not in the future", async () => {
        const { embalmerFacet, identifier, embalmer } =
          await failingRewrapFixture();

        // Define a new resurrection time not in the future
        const newResurrectionTime = BigNumber.from(
          (Date.now() / 1000).toFixed(0)
        );

        // Rewrap the sarcophagus
        const tx = embalmerFacet
          .connect(embalmer)
          .rewrapSarcophagus(identifier, newResurrectionTime);

        await expect(tx).to.be.revertedWith("NewResurrectionTimeInPast");
      });
    });
  });

  describe("cancelSarcophagus()", () => {
    context("Successful cancel", () => {
      it("should set the sarcophagus state to done", async () => {
        const { viewStateFacet, identifier } = await successfulCancelFixture();
        const sarcophagus = await viewStateFacet.getSarcophagus(identifier);

        expect(sarcophagus.state).to.equal(SarcophagusState.Done);
      });

      it("should transfer total fees back to the embalmer", async () => {
        const { sarcoToken, embalmer, embalmerBalance } =
          await successfulCancelFixture();
        // Get the sarco balance of the embalmer after canceling the sarcophagus
        const embalmerBalanceAfter = await sarcoToken.balanceOf(
          embalmer.address
        );

        expect(embalmerBalance).to.equal(embalmerBalanceAfter);
      });

      it("should emit an event", async () => {
        const { tx, embalmerFacet } = await successfulCancelFixture();

        const receipt = await tx.wait();

        const events = receipt.events!;
        expect(events).to.not.be.undefined;

        // Check that the list of events includes an event that has an address
        // matching the embalmerFacet address
        expect(events.some((event) => event.address === embalmerFacet.address))
          .to.be.true;
      });
    });

    context("Failed cancel", () => {
      it("should revert if the sender is not the embalmer", async () => {
        const { embalmerFacet, archaeologists, identifier } =
          await failingCancelFixture();

        const tx = embalmerFacet
          .connect(archaeologists[0].signer)
          .cancelSarcophagus(identifier);

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus does not exist", async () => {
        const { embalmerFacet, embalmer } = await failingCancelFixture();
        const falseIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["falseIdentifier"]
        );

        const tx = embalmerFacet
          .connect(embalmer)
          .cancelSarcophagus(falseIdentifier);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sarcohaphagus is already finalized", async () => {
        const {
          embalmerFacet,
          embalmer,
          identifier,
          arweaveArchSig,
          arweaveTxId,
          signatures,
        } = await failingCancelFixture();

        // finalize the sarcophagus
        await embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            signatures,
            arweaveArchSig,
            arweaveTxId
          );

        const tx = embalmerFacet
          .connect(embalmer)
          .cancelSarcophagus(identifier);

        await expect(tx).to.be.revertedWith("SarcophagusAlreadyFinalized");
      });
    });
  });

  describe("burySarcophagus()", () => {
    context("Successful bury", () => {
      it("should set resurrection time to inifinity", async () => {
        const { viewStateFacet, identifier } = await successfulBuryFixture();
        const sarcophagus = await viewStateFacet.getSarcophagus(identifier);

        expect(sarcophagus.resurrectionTime).to.equal(
          ethers.constants.MaxUint256
        );
      });

      it("should set the sarcophagus state to done", async () => {
        const { viewStateFacet, identifier } = await successfulBuryFixture();

        const sarcophagus = await viewStateFacet.getSarcophagus(identifier);

        expect(sarcophagus.state).to.equal(SarcophagusState.Done);
      });

      it("should free an archaeologist's bond", async () => {
        const {
          viewStateFacet,
          regularArchaeologist,
          regularArchaeologistFreeBond,
          regularArchaeologistCursedBond,
        } = await successfulBuryFixture();

        // Get the free and cursed bond after bury
        const freeBondAfter = await viewStateFacet.getFreeBond(
          regularArchaeologist.account
        );
        const cursedBondAfter = await viewStateFacet.getCursedBond(
          regularArchaeologist.account
        );

        expect(freeBondAfter).to.equal(regularArchaeologistFreeBond);
        expect(cursedBondAfter).to.equal(regularArchaeologistCursedBond);
      });

      it("should transfer digging fees to each archaeologist", async () => {
        const {
          sarcoToken,
          regularArchaeologist,
          regularArchaeologistBalance,
        } = await successfulBuryFixture();

        // Get the archaeologist sarco balance after bury
        const sarcoBalanceAfter = await sarcoToken.balanceOf(
          regularArchaeologist.account
        );

        // Get the archaeologist's digging fees with the archaeologist address

        // Check that the difference in balances is equal to the digging fee
        expect(sarcoBalanceAfter.sub(regularArchaeologistBalance)).to.equal(
          regularArchaeologist.diggingFee
        );
      });

      it("should transfer the bounty back to the embalmer", async () => {
        const { sarcoToken, embalmer, archaeologists, embalmerBalance } =
          await successfulBuryFixture();

        // Get the archaeologist sarco balance after bury
        const sarcoBalanceAfter = await sarcoToken.balanceOf(embalmer.address);

        // Add the bounties in archaeologist fees
        const totalBounty = archaeologists.reduce(
          (acc, arch) => acc.add(arch.bounty),
          ethers.constants.Zero
        );

        // Check that the difference in balances is equal to the total bounty
        expect(sarcoBalanceAfter.sub(embalmerBalance)).to.equal(totalBounty);
      });

      it("should emit an event", async () => {
        const { tx, embalmerFacet } = await successfulBuryFixture();

        const receipt = await tx.wait();

        const events = receipt.events!;
        expect(events).to.not.be.undefined;

        // Check that the list of events includes an event that has an address
        // matching the embalmerFacet address
        expect(events.some((event) => event.address === embalmerFacet.address))
          .to.be.true;
      });
    });

    context("Failed bury", () => {
      it("should revert if sender is not the embalmer", async () => {
        const { embalmerFacet, identifier } = await failingBuryFixture();
        const signers = await ethers.getSigners();

        const tx = embalmerFacet
          .connect(signers[9])
          .burySarcophagus(identifier);

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus does not exist", async () => {
        const { embalmerFacet, embalmer } = await failingBuryFixture();

        const falseIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["falseIdentifier"]
        );

        const tx = embalmerFacet
          .connect(embalmer)
          .burySarcophagus(falseIdentifier);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sarcophagus is not finalized", async () => {
        // Use the initializeSarcophagus fixture in this case to create a
        // sarcophagus
        const { embalmerFacet, embalmer, identifier } =
          await successfulInitializeSarcophagusFixture();

        // Bury the sarcophagus
        const tx = embalmerFacet.connect(embalmer).burySarcophagus(identifier);

        await expect(tx).to.be.revertedWith("SarcophagusNotFinalized");
      });
    });
  });
});
