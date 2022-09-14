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
import { calculateCursedBond, getAttributeFromURI, sign, signMultiple } from "../utils/helpers";
import time from "../utils/time";

describe("Contract: EmbalmerFacet", () => {
  const shares = 5;
  const threshold = 3;
  const sarcoName = "test init";

  describe("createSarcophagus()", () => {
    context("Successful initialization", () => {
      it.only("should transfer fees in sarco token from the embalmer to the contract", async () => {
        const {
          sarcoToken,
          embalmer,
          archaeologists,
          embalmerBalanceBefore,
        } = await createSarcoFixture({ shares, threshold }, sarcoName);

        const embalmerBalanceAfter = await sarcoToken.balanceOf(embalmer.address);

        // Calculate the total fees (all digging fees)
        const totalFees = archaeologists
          .reduce(
            (acc, arch) => acc.add(calculateCursedBond(arch.diggingFee)),
            BigNumber.from("0")
          );

        expect(embalmerBalanceAfter.toString()).to.equal(
          embalmerBalanceBefore.sub(totalFees).toString()
        );
      });

      it("should emit createSarcophagus()", async () => {
        const { embalmerFacet, createTx } = await createSarcoFixture(
          { shares, threshold, skipAwaitCreateTx: true },
          sarcoName
        );

        expect(createTx).to.emit(embalmerFacet, "createSarcophagus");
      });

      it("should set a resurrection window", async () => {
        const { sarcoId, viewStateFacet } = await createSarcoFixture(
          { shares, threshold },
          sarcoName
        );

        const sarco = await viewStateFacet.getSarcophagus(sarcoId);
        expect(sarco.resurrectionWindow).to.be.gt(0);
      });
    });

    context("Failed createSarcophagus", () => {
      it("should revert when creating a sarcophagus that already exists", async () => {
        const {
          embalmer,
          embalmerFacet,
          sarcoId,
          archaeologists,
          recipient,
          resurrectionTime,
          arweaveTxIds
        } = await createSarcoFixture({ shares, threshold }, sarcoName);

        // Try to create the same sarcophagus again
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            canBeTransferred: true,
            minShards: threshold,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("SarcophagusAlreadyExists");
      });

      it("should revert if the resurrection time is not in the future", async () => {
        const {
          sarcoId,
          embalmerFacet,
          embalmer,
          archaeologists,
          recipient,
          arweaveTxIds
        } = await createSarcoFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        // Initialise the sarco with resurrection time 1 second in past
        const resurrectionTime = (await time.latest()) - 1;
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            canBeTransferred: true,
            minShards: threshold,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("ResurrectionTimeInPast");
      });

      it("should revert if no archaeologists are provided", async () => {
        const { sarcoId, embalmerFacet, embalmer, recipient, arweaveTxIds } =
          await createSarcoFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        // Initialise the sarco without archaeologists
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            canBeTransferred: true,
            minShards: threshold,
          },
          [],
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("NoArchaeologistsProvided");
      });

      it("should revert if the list of archaeologists is not unique", async () => {
        const {
          sarcoId,
          archaeologists,
          embalmerFacet,
          embalmer,
          recipient,
          arweaveTxIds
        } = await createSarcoFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        const nonUniqueArchaeologists = archaeologists.slice();
        nonUniqueArchaeologists.pop();
        const firstArchaeologist = archaeologists[0];
        nonUniqueArchaeologists.push(firstArchaeologist);

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            canBeTransferred: true,
            minShards: threshold,
          },
          nonUniqueArchaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("ArchaeologistListNotUnique");
      });

      it("should revert if minShards is greater than the number of archaeologists", async () => {
        const {
          sarcoId,
          archaeologists,
          embalmerFacet,
          embalmer,
          recipient,
          arweaveTxIds
        } = await createSarcoFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            canBeTransferred: true,
            minShards: archaeologists.length + 1,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("MinShardsGreaterThanArchaeologists");
      });

      it("should revert if minShards is 0", async () => {
        const {
          sarcoId,
          archaeologists,
          embalmerFacet,
          embalmer,
          recipient,
          arweaveTxIds
        } = await createSarcoFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            canBeTransferred: true,
            minShards: 0,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("MinShardsZero");
      });
    });
  });

  describe("finalizeSarcophagus()", () => {
    context("Successful finalization", () => {
      it("should store the arweave transaction id", async () => {
        const { sarcoId, viewStateFacet, arweaveTxIds } = await createSarcoFixture(
          { shares, threshold },
          sarcoName
        );

        const sarcophagusStored = await viewStateFacet.getSarcophagus(sarcoId);
        expect(sarcophagusStored.arweaveTxIds).to.eq(arweaveTxIds);
      });

      it("should mint nfts for the archaeologists", async () => {
        const { curses, archaeologists, sarcoId, viewStateFacet } = await createSarcoFixture(
          { shares, threshold },
          sarcoName
        );

        const balancePromises = archaeologists.map(async arch => {
          const sarcArch = await viewStateFacet.getSarcophagusArchaeologist(
            sarcoId,
            arch.archAddress
          );
          const curseTokenId = sarcArch.curseTokenId;
          return (await curses.balanceOf(arch.archAddress, curseTokenId)).toString();
        });

        const balances = await Promise.all(balancePromises);

        const expected = archaeologists.map(() => "1");
        expect(balances).to.deep.equal(expected);
      });

      it("should lock up an archaeologist's free bond", async () => {
        const {
          sarcoId,
          viewStateFacet,
          recipient,
          arweaveTxIds,
          embalmerFacet,
          embalmer,
          archaeologists,
        } = await createSarcoFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        const regularArchaeologist = archaeologists[1];

        const archaeologistFreeBondBefore = await viewStateFacet.getFreeBond(
          regularArchaeologist.archAddress
        );
        const archaeologistCursedBondBefore = await viewStateFacet.getCursedBond(
          regularArchaeologist.archAddress
        );

        await embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            canBeTransferred: true,
            minShards: 0,
          },
          archaeologists,
          arweaveTxIds
        );

        const archaeologistFreeBondAfter = await viewStateFacet.getFreeBond(
          regularArchaeologist.archAddress
        );
        const archaeologistCursedBondAfter = await viewStateFacet.getCursedBond(
          regularArchaeologist.archAddress
        );

        const bondAmount = calculateCursedBond(
          regularArchaeologist.diggingFee
        );

        // Check that the archaeologist's free bond afterward has descreased by the bond amount
        expect(archaeologistFreeBondAfter).to.equal(archaeologistFreeBondBefore.sub(bondAmount));

        // Check that the archaeologist's cursed bond has increased by the bond amount
        expect(archaeologistCursedBondAfter).to.equal(
          archaeologistCursedBondBefore.add(bondAmount)
        );
      });

      it("should emit CreateSarcophagus()", async () => {
        const { createTx, embalmerFacet } = await createSarcoFixture(
          { shares, threshold },
          sarcoName
        );

        expect(createTx).to.emit(embalmerFacet, "CreateSarcophagus");
      });
    });

    context("General reverts", () => {
      it("should revert if the provided arweave transaction id is empty", async () => {
        const { createTx } =
          await createSarcoFixture({ shares, threshold, skipAwaitCreateTx: true }, sarcoName);

        await expect(createTx).to.be.revertedWith("ArweaveTxIdEmpty");
      });
    });

    context("Signature reverts", () => {
      it("should revert if any signature provided by a regular archaeologist is from the wrong archaeologist", async () => {
        const {
          embalmer,
          embalmerFacet,
          sarcoId,
          archaeologists,
          recipient,
          resurrectionTime,
          arweaveTxIds
        } = await createSarcoFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        const signers = await ethers.getSigners();

        // Get a false signer
        const falseSigner = signers[9];
        const falseSig = await sign(falseSigner, [archaeologists[0].unencryptedShardDoubleHash, arweaveTxIds[1]], ["bytes32", "string"])
        archaeologists[0].v = falseSig.v;
        archaeologists[0].r = falseSig.r;
        archaeologists[0].s = falseSig.s;

        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            canBeTransferred: true,
            minShards: threshold,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("ArchaeologistNotOnSarcophagus");
      });

      it("should revert if any archaeologist signature includes the wrong data", async () => {
        const {
          embalmer,
          embalmerFacet,
          sarcoId,
          archaeologists,
          recipient,
          resurrectionTime,
          arweaveTxIds
        } = await createSarcoFixture({ shares, threshold, skipCreateTx: true }, sarcoName);

        const sigWithBadData = await sign(archaeologists[0].signer, [archaeologists[0].unencryptedShardDoubleHash, "some nonsense"], ["bytes32", "string"])
        archaeologists[0].v = sigWithBadData.v;
        archaeologists[0].r = sigWithBadData.r;
        archaeologists[0].s = sigWithBadData.s;

        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            canBeTransferred: true,
            minShards: threshold,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWith("SignatureFromWrongAccount");
      });
    });
  });

  describe("rewrapSarcophagus()", () => {
    context("Successful rewrap", () => {
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

      it("should update the resurrection time on the curse nft", async () => {
        const { tx, curses, archaeologists, viewStateFacet, sarcoId, newResurrectionTime } =
          await rewrapFixture({ shares, threshold }, sarcoName);
        await tx;

        // Get an archaeologist's curse token id
        const oneArchaeologist = archaeologists[0];
        const archData = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          oneArchaeologist.archAddress
        );

        // Get the resurrectionTime from the nft attributes
        const uri = await curses.uri(archData.curseTokenId);
        const resurrectionTime = getAttributeFromURI(uri, "Resurrection Time");

        expect(resurrectionTime).to.equal(newResurrectionTime);
      });

      it("should add digging fees to the archaeologist's total digging fees paid", async () => {
        const {
          tx,
          curses,
          archaeologists,
          viewStateFacet,
          sarcoId,
          embalmerFacet,
          embalmer,
          newResurrectionTime,
        } = await rewrapFixture({ shares, threshold }, sarcoName);
        await tx;

        // Rewrap a second time
        await embalmerFacet
          .connect(embalmer)
          .rewrapSarcophagus(sarcoId, newResurrectionTime + 604800);

        // Get an archaeologist's curse token id
        const oneArchaeologist = archaeologists[0];
        const archData = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          oneArchaeologist.archAddress
        );

        // Get the digging fees paid from the nft attributes
        const uri = await curses.uri(archData.curseTokenId);
        const diggingFeesPaid = getAttributeFromURI(uri, "Digging Fees Paid");

        expect(diggingFeesPaid).to.be.equal(20);
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
        // Use the fixture for createSarcophagus just this once so we can
        // properly initialize the sarcophagus
        const { tx } = await rewrapFixture(
          {
            shares,
            threshold,
            skipFinaliseSarco: true,
            dontAwaitTransaction: true,
          },
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
            .add(calculateCursedBond(regularArchaeologist.diggingFee))
            .toString()
        );

        expect(cursedBondAfter.toString()).to.equal(
          regularArchaeologistCursedBondBefore
            .sub(calculateCursedBond(regularArchaeologist.diggingFee))
            .toString()
        );
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
