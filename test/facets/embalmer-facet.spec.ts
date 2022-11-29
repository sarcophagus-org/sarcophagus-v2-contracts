import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { createSarcoFixture } from "../fixtures/create-sarco-fixture";
import { buryFixture } from "../fixtures/bury-fixture";
import { rewrapFixture } from "../fixtures/rewrap-fixture";
import { sign, toSarco } from "../utils/helpers";
import time from "../utils/time";
import { hashBytes, TestArchaeologist } from "../fixtures/spawn-archaeologists";

describe("Contract: EmbalmerFacet", () => {
  const shares = 5;
  const threshold = 3;
  const sarcoName = "test init";

  describe("createSarcophagus()", () => {
    context("Successful creation", () => {
      it("should transfer fees in sarco token from the embalmer to the contract", async () => {
        const {
          deployer,
          sarcoToken,
          embalmer,
          archaeologists,
          embalmerBalanceBeforeCreate,
          viewStateFacet,
        } = await createSarcoFixture({ shares, threshold }, sarcoName);

        const embalmerBalanceAfter = await sarcoToken.balanceOf(
          embalmer.address
        );

        // Calculate the total fees (all digging fees)
        const totalDiggingFees: BigNumber = archaeologists.reduce(
          (acc: BigNumber, arch: TestArchaeologist) => acc.add(arch.diggingFee),
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

        expect(embalmerBalanceAfter.toString()).to.equal(
          embalmerBalanceBeforeCreate.sub(totalFees).toString()
        );
      });

      it("emits CreateSarcophagus()", async () => {
        const { embalmerFacet, createTx } = await createSarcoFixture(
          { shares, threshold, skipAwaitCreateTx: true },
          sarcoName
        );

        await expect(createTx).to.emit(embalmerFacet, "CreateSarcophagus");
      });

      it("stores the arweave transaction ids", async () => {
        const { sarcoId, viewStateFacet, arweaveTxIds } =
          await createSarcoFixture({ shares, threshold }, sarcoName);

        const sarcophagusStored = await viewStateFacet.getSarcophagus(sarcoId);
        expect(sarcophagusStored.arweaveTxIds.length).to.eq(2);
        expect(sarcophagusStored.arweaveTxIds[0]).to.eq(arweaveTxIds[0]);
        expect(sarcophagusStored.arweaveTxIds[1]).to.eq(arweaveTxIds[1]);
      });

      it("locks up an archaeologist's free bond", async () => {
        const {
          sarcoId,
          viewStateFacet,
          recipient,
          arweaveTxIds,
          embalmerFacet,
          embalmer,
          archaeologists,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );

        const regularArchaeologist = archaeologists[1];

        const archaeologistFreeBondBefore = await viewStateFacet.getFreeBond(
          regularArchaeologist.archAddress
        );
        const archaeologistCursedBondBefore =
          await viewStateFacet.getCursedBond(regularArchaeologist.archAddress);

        await embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            threshold: 4,
            creationTime: timestamp,
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

        const bondAmount = regularArchaeologist.diggingFee;

        // Check that the archaeologist's free bond afterward has descreased by the bond amount
        expect(archaeologistFreeBondAfter).to.equal(
          archaeologistFreeBondBefore.sub(bondAmount)
        );

        // Check that the archaeologist's cursed bond has increased by the bond amount
        expect(archaeologistCursedBondAfter).to.equal(
          archaeologistCursedBondBefore.add(bondAmount)
        );
      });

      it("transfers the protocol fees from the embalmer to the contract", async () => {
        const _shares = 5;
        const _threshold = 3;
        const archMinDiggingFee = toSarco(5);

        const {
          sarcoToken,
          viewStateFacet,
          embalmer,
          embalmerFacet,
          sarcoId,
          recipient,
          archaeologists,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture({
          shares: _shares,
          threshold: _threshold,
          archMinDiggingFee,
          skipCreateTx: true,
        });

        // Total min digging fees will be 25 SARCO (5 archs * 5 sarco digging fee)
        const totalDiggingFees = BigNumber.from(_shares).mul(archMinDiggingFee);
        // Protocol fee defaults to 1
        const protocolFee = await viewStateFacet
          .connect(embalmer)
          .getProtocolFeeBasePercentage();
        // total protocol fees will be .25 SARCO (25 * 1 / 100)
        const expectedTotalProtocolFees = totalDiggingFees
          .mul(protocolFee)
          .div(100);

        // validate balance after create sarcophagus
        const embalmerBalanceBeforeCreate = await sarcoToken.balanceOf(
          embalmer.address
        );

        await embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            threshold: _threshold,
            creationTime: timestamp,
          },
          archaeologists,
          arweaveTxIds
        );

        // confirm that protocol fee amount is updated on the contract
        const actualTotalProtocolFees = await viewStateFacet
          .connect(embalmer)
          .getTotalProtocolFees();
        expect(actualTotalProtocolFees).to.equal(expectedTotalProtocolFees);

        // confirm embalmers SARCO balance has been debited
        const embalmerBalanceAfterCreate = await sarcoToken.balanceOf(
          embalmer.address
        );
        expect(embalmerBalanceAfterCreate).to.equal(
          embalmerBalanceBeforeCreate
            .sub(totalDiggingFees)
            .sub(expectedTotalProtocolFees)
        );
      });

      it("should set the correct maxRewrapInterval on a sarcophagus", async () => {
        const { sarcoId, viewStateFacet, maximumRewrapInterval } =
          await createSarcoFixture({ shares, threshold }, sarcoName);

        const sarco = await viewStateFacet.getSarcophagus(sarcoId);
        expect(sarco.maximumRewrapInterval).to.be.eq(maximumRewrapInterval);
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
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture({ shares, threshold }, sarcoName);

        // Try to create the same sarcophagus again
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime,
            threshold: threshold,
            maximumRewrapInterval,
            creationTime: timestamp,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "SarcophagusAlreadyExists"
        );
      });

      it("should revert if the resurrection time is not in the future", async () => {
        const {
          sarcoId,
          embalmerFacet,
          embalmer,
          archaeologists,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );

        // Initialise the sarco with resurrection time 1 second in past
        const resurrectionTime = (await time.latest()) - 1;
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            threshold: threshold,
            creationTime: timestamp,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "ResurrectionTimeInPast"
        );
      });

      it("should revert if no archaeologists are provided", async () => {
        const {
          sarcoId,
          embalmerFacet,
          embalmer,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );

        // Create the sarco without archaeologists
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            threshold,
            creationTime: timestamp,
          },
          [],
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "NoArchaeologistsProvided"
        );
      });

      it("should revert if the list of archaeologists is not unique", async () => {
        const {
          sarcoId,
          archaeologists,
          embalmerFacet,
          embalmer,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );

        const nonUniqueArchaeologists = archaeologists.slice();
        nonUniqueArchaeologists.pop();
        const firstArchaeologist = archaeologists[0];
        nonUniqueArchaeologists.push(firstArchaeologist);

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            threshold,
            creationTime: timestamp,
          },
          nonUniqueArchaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "ArchaeologistListNotUnique"
        );
      });

      it("should revert if minShards is greater than the number of archaeologists", async () => {
        const {
          sarcoId,
          archaeologists,
          embalmerFacet,
          embalmer,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            threshold: archaeologists.length + 1,
            creationTime: timestamp,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "MinShardsGreaterThanArchaeologists"
        );
      });

      it("should revert if minShards is 0", async () => {
        const {
          sarcoId,
          archaeologists,
          embalmerFacet,
          embalmer,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );

        // Create a sarcophagus as the embalmer
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            threshold: 0,
            creationTime: timestamp,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "MinShardsZero"
        );
      });

      it("reverts if the embalmer does not provide enough digging fee", async () => {
        // Set min digging fees for each archaeologist profile to 10
        const {
          archaeologists,
          embalmer,
          embalmerFacet,
          sarcoId,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture(
          {
            shares,
            threshold,
            archMinDiggingFee: BigNumber.from("10"),
            skipCreateTx: true,
          },
          sarcoName
        );

        // set one of the archaeologist's digging fees too low
        archaeologists[0].diggingFee = BigNumber.from("9");

        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            threshold,
            creationTime: timestamp,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "InvalidSignature"
        );
      });

      it("reverts if any signature provided by a regular archaeologist is from the wrong archaeologist", async () => {
        const {
          embalmer,
          embalmerFacet,
          sarcoId,
          archaeologists,
          recipient,
          resurrectionTime,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );

        const signers = await ethers.getSigners();

        // Get a false signer
        const falseSigner = signers[9];
        const falseSig = await sign(
          falseSigner,
          [archaeologists[0].doubleHashedKeyShare, arweaveTxIds[1]],
          ["bytes32", "string"]
        );
        archaeologists[0].v = falseSig.v;
        archaeologists[0].r = falseSig.r;
        archaeologists[0].s = falseSig.s;

        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            threshold,
            creationTime: timestamp,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "InvalidSignature"
        );
      });

      it("reverts if any archaeologist signature includes the wrong data", async () => {
        const {
          embalmer,
          embalmerFacet,
          sarcoId,
          archaeologists,
          recipient,
          resurrectionTime,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );

        const sigWithBadData = await sign(
          archaeologists[0].signer,
          [
            arweaveTxIds[1],
            archaeologists[0].doubleHashedKeyShare,
            "100",
            "100",
          ],
          ["string", "bytes32", "uint256", "uint256"]
        );
        archaeologists[0].v = sigWithBadData.v;
        archaeologists[0].r = sigWithBadData.r;
        archaeologists[0].s = sigWithBadData.s;

        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            threshold,
            creationTime: timestamp,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "InvalidSignature"
        );
      });

      it("should fail to create a sarcophagus with a resurrectionTime that exceeds the maxRewrapInterval", async () => {
        const {
          sarcoId,
          embalmerFacet,
          embalmer,
          archaeologists,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );

        // Initialise the sarco with resurrection time 1 minute beyond maximum
        const resurrectionTime =
          (await time.latest()) +
          maximumRewrapInterval +
          time.duration.minutes(1);

        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            threshold,
            creationTime: timestamp,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "ResurrectionTimeTooFarInFuture"
        );
      });
      it("should fail to create a sarcophagus where an archaeologist hasn't agreed to the supplied maxRewrapInterval", async () => {
        const {
          sarcoId,
          embalmerFacet,
          embalmer,
          archaeologists,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          resurrectionTime,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );
        // change archaeologists[0]'s signature to use the wrong maximumRewrapInterval
        const disagreableArchaeologistSigner = await ethers.getSigner(
          archaeologists[0].archAddress
        );
        const disagreeingSignature = await sign(
          disagreableArchaeologistSigner,
          [
            arweaveTxIds[1],
            archaeologists[0].doubleHashedKeyShare,
            (maximumRewrapInterval + time.duration.minutes(1)).toString(),
            timestamp.toString(),
          ],
          ["string", "bytes32", "uint256", "uint256"]
        );
        archaeologists[0].r = disagreeingSignature.r;
        archaeologists[0].s = disagreeingSignature.s;
        archaeologists[0].v = disagreeingSignature.v;
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            threshold,
            creationTime: timestamp,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "InvalidSignature"
        );
      });

      it("should revert when creating a sarcophagus with an expired timestamp", async () => {
        const {
          sarcoId,
          viewStateFacet,
          recipient,
          arweaveTxIds,
          embalmerFacet,
          embalmer,
          archaeologists,
          maximumRewrapInterval,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );

        const expirationThreshold =
          await viewStateFacet.getExpirationThreshold();

        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime: (await time.latest()) + 100,
            maximumRewrapInterval,
            threshold: 4,
            creationTime:
              (await time.latest()) - expirationThreshold.toNumber(),
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "SarcophagusParametersExpired"
        );
      });
      it("should revert when creating a sarcophagus with a timestamp an archaeologist hasn't agreed to", async () => {
        const {
          sarcoId,
          embalmerFacet,
          embalmer,
          archaeologists,
          recipient,
          arweaveTxIds,
          maximumRewrapInterval,
          resurrectionTime,
          timestamp,
        } = await createSarcoFixture(
          { shares, threshold, skipCreateTx: true },
          sarcoName
        );
        // change archaeologists[0]'s signature to use the wrong maximumRewrapInterval
        const disagreableArchaeologistSigner = await ethers.getSigner(
          archaeologists[0].archAddress
        );
        const disagreeingSignature = await sign(
          disagreableArchaeologistSigner,
          [
            arweaveTxIds[1],
            archaeologists[0].doubleHashedKeyShare,
            (maximumRewrapInterval + time.duration.minutes(1)).toString(),
            (timestamp + 1).toString(),
          ],
          ["string", "bytes32", "uint256", "uint256"]
        );
        archaeologists[0].r = disagreeingSignature.r;
        archaeologists[0].s = disagreeingSignature.s;
        archaeologists[0].v = disagreeingSignature.v;
        const tx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipientAddress: recipient.address,
            resurrectionTime,
            maximumRewrapInterval,
            threshold,
            creationTime: timestamp,
          },
          archaeologists,
          arweaveTxIds
        );

        await expect(tx).to.be.revertedWithCustomError(
          embalmerFacet,
          "InvalidSignature"
        );
      });
    });
  });

  describe("rewrapSarcophagus()", () => {
    context("Successful rewrap", () => {
      it("transfers protocol fees from the embalmer to the contract", async () => {
        const _shares = 5;
        const _threshold = 3;
        const archMinDiggingFee = toSarco(8);

        const {
          viewStateFacet,
          totalProtocolFeesBeforeRewrap,
          embalmerBalanceBeforeRewrap,
          embalmer,
          sarcoToken,
        } = await rewrapFixture({
          shares: _shares,
          threshold: _threshold,
          archMinDiggingFee,
        });

        const totalDiggingFees = BigNumber.from(_shares).mul(archMinDiggingFee);
        const protocolFee = await viewStateFacet.getProtocolFeeBasePercentage();
        const expectedTotalProtocolFees = totalDiggingFees
          .mul(protocolFee)
          .div(100);
        const totalProtocolFeesAfterRewrap =
          await viewStateFacet.getTotalProtocolFees();

        // confirm that protocol fee amount is updated on the contract
        expect(
          totalProtocolFeesAfterRewrap.sub(totalProtocolFeesBeforeRewrap)
        ).to.equal(expectedTotalProtocolFees);

        // confirm embalmers SARCO balance has been debited
        const embalmerBalanceAfterRewrap = await sarcoToken.balanceOf(
          embalmer.address
        );
        expect(embalmerBalanceAfterRewrap).to.equal(
          embalmerBalanceBeforeRewrap
            .sub(totalDiggingFees)
            .sub(expectedTotalProtocolFees)
        );
      });

      it("emits an event", async () => {
        const { tx, embalmerFacet } = await rewrapFixture(
          { shares, threshold },
          sarcoName
        );
        await expect(tx).to.emit(embalmerFacet, "RewrapSarcophagus");
      });

      context("Failed rewrap", () => {
        it("should revert if the sender is not embalmer", async () => {
          const { embalmerFacet, sarcoId } = await rewrapFixture(
            { shares, threshold, skipRewrap: true },
            sarcoName
          );

          const signers = await ethers.getSigners();

          // Define a new resurrection time one week in the future
          const newResurrectionTime =
            (await time.latest()) + time.duration.weeks(1);

          // Rewrap the sarcophagus
          const tx = embalmerFacet
            .connect(signers[8])
            .rewrapSarcophagus(sarcoId, newResurrectionTime);

          await expect(tx).to.be.revertedWithCustomError(
            embalmerFacet,
            "SenderNotEmbalmer"
          );
        });

        it("should revert if the sarcophagus does not exist", async () => {
          const { embalmerFacet, embalmer, newResurrectionTime } =
            await rewrapFixture(
              { shares, threshold, skipRewrap: true },
              sarcoName
            );
          const falseIdentifier = ethers.utils.solidityKeccak256(
            ["string"],
            ["falseIdentifier"]
          );

          // Rewrap the sarcophagus
          const tx = embalmerFacet
            .connect(embalmer)
            .rewrapSarcophagus(falseIdentifier, newResurrectionTime);

          await expect(tx).to.be.revertedWithCustomError(
            embalmerFacet,
            "SarcophagusDoesNotExist"
          );
        });

        it("should revert if the sarcophagus is inactive", async () => {
          const { embalmerFacet, embalmer, newResurrectionTime, sarcoId } =
            await rewrapFixture(
              { shares, threshold, skipRewrap: true },
              sarcoName
            );

          // Bury the sarcophagus, this deactivates it (state set to `Buried`)
          await embalmerFacet.connect(embalmer).burySarcophagus(sarcoId);

          const tx = embalmerFacet
            .connect(embalmer)
            .rewrapSarcophagus(sarcoId, newResurrectionTime);

          await expect(tx).to.be.revertedWithCustomError(
            embalmerFacet,
            "SarcophagusInactive"
          );
        });

        it("should revert if the new resurrection time is not in the future", async () => {
          const { embalmerFacet, sarcoId, embalmer } = await rewrapFixture(
            { shares, threshold, skipRewrap: true },
            sarcoName
          );

          // Define a new resurrection time not in the future
          const newResurrectionTime = (await time.latest()) - 1;

          // Rewrap the sarcophagus
          const tx = embalmerFacet
            .connect(embalmer)
            .rewrapSarcophagus(sarcoId, newResurrectionTime);

          await expect(tx).to.be.revertedWithCustomError(
            embalmerFacet,
            "NewResurrectionTimeInPast"
          );
        });

        it("should fail to rewrap a sarcophagus with a new resurrection time in excess of the maxRewrapInterval", async () => {
          const {
            sarcoId,
            embalmerFacet,
            embalmer,
            archaeologists,
            recipient,
            arweaveTxIds,
            maximumRewrapInterval,
            resurrectionTime,
            timestamp,
          } = await createSarcoFixture(
            { shares, threshold, skipCreateTx: true },
            sarcoName
          );

          await embalmerFacet.connect(embalmer).createSarcophagus(
            sarcoId,
            {
              name: sarcoName,
              recipientAddress: recipient.address,
              resurrectionTime,
              maximumRewrapInterval,
              threshold,
              creationTime: timestamp,
            },
            archaeologists,
            arweaveTxIds
          );

          const tx = embalmerFacet
            .connect(embalmer)
            .rewrapSarcophagus(
              sarcoId,
              (await time.latest()) +
                maximumRewrapInterval +
                time.duration.minutes(1)
            );

          await expect(tx).to.be.revertedWithCustomError(
            embalmerFacet,
            "NewResurrectionTimeTooLarge"
          );
        });
      });
    });

    describe("burySarcophagus()", () => {
      context("Successful bury", () => {
        it("should set resurrection time to inifinity", async () => {
          const { viewStateFacet, sarcoId } = await buryFixture(
            { shares, threshold },
            sarcoName
          );
          const sarcophagus = await viewStateFacet.getSarcophagus(sarcoId);

          expect(sarcophagus.resurrectionTime).to.equal(
            ethers.constants.MaxUint256
          );
        });

        it("should set the sarcophagus state to buried", async () => {
          const { viewStateFacet, sarcoId } = await buryFixture(
            { shares, threshold },
            sarcoName
          );

          const sarcophagus = await viewStateFacet.getSarcophagus(sarcoId);
          expect(sarcophagus.resurrectionTime).to.equal(
            BigNumber.from(2).pow(256).sub(1)
          );
        });

        it("should free an archaeologist's bond", async () => {
          const {
            viewStateFacet,
            regularArchaeologist,
            regularArchaeologistFreeBondBefore,
            regularArchaeologistCursedBondBefore,
          } = await buryFixture({ shares, threshold }, sarcoName);

          // Get the free and cursed bond after bury
          const freeBondAfter = await viewStateFacet.getFreeBond(
            regularArchaeologist.archAddress
          );
          const cursedBondAfter = await viewStateFacet.getCursedBond(
            regularArchaeologist.archAddress
          );

          expect(freeBondAfter.toString()).to.equal(
            regularArchaeologistFreeBondBefore
              .add(regularArchaeologist.diggingFee)
              .toString()
          );

          expect(cursedBondAfter.toString()).to.equal(
            regularArchaeologistCursedBondBefore
              .sub(regularArchaeologist.diggingFee)
              .toString()
          );
        });

        it("should emit BurySarcophagus()", async () => {
          const { tx, embalmerFacet, sarcoId } = await buryFixture(
            { shares, threshold },
            sarcoName
          );
          await expect(tx)
            .to.emit(embalmerFacet, "BurySarcophagus")
            .withArgs(sarcoId);
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

          await expect(tx).to.be.revertedWithCustomError(
            embalmerFacet,
            "SenderNotEmbalmer"
          );
        });

        it("should revert if the sarcophagus does not exist", async () => {
          const { embalmerFacet, embalmer } = await buryFixture(
            { shares, threshold, skipBury: true, dontAwaitTransaction: true },
            sarcoName
          );

          const falseIdentifier = ethers.utils.solidityKeccak256(
            ["string"],
            ["falseIdentifier"]
          );

          const tx = embalmerFacet
            .connect(embalmer)
            .burySarcophagus(falseIdentifier);

          await expect(tx).to.be.revertedWithCustomError(
            embalmerFacet,
            "SarcophagusDoesNotExist"
          );
        });

        it("should revert if the sarcophagus is compromised", async () => {
          const {
            embalmerFacet,
            thirdPartyFacet,
            embalmer,
            sarcoId,
            archaeologists,
          } = await buryFixture(
            { shares, threshold, skipBury: true },
            sarcoName
          );

          // Accuse the sarcophagus, this deactivates it (state set to `Accused`)
          await thirdPartyFacet.connect(embalmer).accuse(
            sarcoId,
            archaeologists
              .slice(0, threshold)
              .map((a: TestArchaeologist) => hashBytes(a.rawKeyShare)),
            embalmer.address
          );

          const tx = embalmerFacet.connect(embalmer).burySarcophagus(sarcoId);

          await expect(tx).to.be.revertedWithCustomError(
            embalmerFacet,
            "SarcophagusCompromised"
          );
        });
      });
    });
  });
});
