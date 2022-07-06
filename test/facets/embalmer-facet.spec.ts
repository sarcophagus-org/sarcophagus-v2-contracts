import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import { BigNumber, ContractTransaction, Signature } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { deployments, ethers, getUnnamedAccounts } from "hardhat";
import {
  ArchaeologistFacet,
  SarcoTokenMock,
  ViewStateFacet,
} from "../../typechain";
import { EmbalmerFacet } from "../../typechain/EmbalmerFacet";
import { FixtureArchaeologist, SarcophagusState } from "../../types";
import { initializeSarcophagus } from "../fixtures/initialize-sarcophagus";
import { coreSetup } from "../fixtures/setup";
import { setupArweaveArchSig } from "../fixtures/setup-arweave-archaeologist-signature";
import { sign, signMultiple } from "../utils/helpers";

describe("Contract: EmbalmerFacet", () => {
  let embalmerFacet: EmbalmerFacet;
  let archaeologistFacet: ArchaeologistFacet;
  let viewStateFacet: ViewStateFacet;
  let embalmer: SignerWithAddress;
  let archaeologists: FixtureArchaeologist[];
  let recipient: SignerWithAddress;
  let arweaveArchaeologist: FixtureArchaeologist;
  let randomArchaeologist: FixtureArchaeologist;
  let sarcoToken: SarcoTokenMock;
  let signers: SignerWithAddress[];

  beforeEach(async () => {
    ({ embalmer, archaeologists } = await coreSetup());
    arweaveArchaeologist = archaeologists[0];
    randomArchaeologist = archaeologists[1];
  });

  describe("initializeSarcophagus()", () => {
    context("Successful initialization", () => {
      let tx: ContractTransaction;
      let embalmerBalance: BigNumber;

      // Load the embalmer's balance
      before(async () => {
        // Get the embalmer's sarco token balance
        embalmerBalance = await sarcoToken.balanceOf(embalmer.address);
      });

      // Initialize the sarcophagus
      before(async () => {
        const name = "Test Sarcophagus";
        const identifier = solidityKeccak256(
          ["string"],
          ["unhashedIdentifier"]
        );
        const canBeTransferred = true;
        // 1 week
        const resurrectionTime = BigNumber.from(
          Date.now() / 1000 + 60 * 60 * 24 * 7
        );
        const minShards = 2;

        // Create a sarcophagus as the embalmer
        tx = await embalmerFacet
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
      });

      it("should successfully initialize sarcophagus", async () => {
        const receipt = await tx.wait();
        expect(receipt.status).to.equal(1);
      });

      it("should transfer fees in sarco token from the embalmer to the contract", async () => {
        const embalmerBalanceAfter = await sarcoToken.balanceOf(
          embalmer.address
        );

        // Find the arweave archaeologist and get their storage fee amount
        const arweaveArchaeologistIndex = archaeologists.findIndex(
          (a) => a.account === arweaveArchaeologist.account
        );
        const arweaveArchaeologistStorageFee = BigNumber.from(
          archaeologists[arweaveArchaeologistIndex].storageFee
        );

        // Calculate the total fees:
        // The arweaver archaeologist's storage fee + all bounties + all digging
        // fees
        const totalFees = archaeologists
          .reduce(
            (acc, arch) => acc.add(arch.bounty).add(arch.diggingFee),
            BigNumber.from("0")
          )
          .add(arweaveArchaeologistStorageFee);

        expect(embalmerBalance.sub(embalmerBalanceAfter)).to.equal(
          BigNumber.from(totalFees)
        );
      });

      it("should emit an event on initialize", async () => {
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
        const name = "Test Sarcophagus";
        const identifier = solidityKeccak256(
          ["string"],
          ["unhashedIdentifier"]
        );
        const canBeTransferred = true;
        // 1 week
        const resurrectionTime = BigNumber.from(
          Date.now() / 1000 + 60 * 60 * 24 * 7
        );
        const minShards = 2;

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
        const name = "Test Sarcophagus";
        const identifier = solidityKeccak256(
          ["string"],
          ["unhashedIdentifier"]
        );
        const canBeTransferred = true;
        // Set resurrection time to 1 second in the past
        const resurrectionTime = BigNumber.from(Date.now() / 1000 - 1);
        const minShards = 2;

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
        const name = "Test Sarcophagus";
        const identifier = solidityKeccak256(
          ["string"],
          ["unhashedIdentifier"]
        );
        const canBeTransferred = true;
        // 1 week
        const resurrectionTime = BigNumber.from(
          Date.now() / 1000 + 60 * 60 * 24 * 7
        );
        const minShards = 2;

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
        const nonUniqueArchaeologists = archaeologists.slice();
        nonUniqueArchaeologists.pop();
        const firstArchaeologist = archaeologists[0];
        nonUniqueArchaeologists.push(firstArchaeologist);

        const name = "Test Sarcophagus";
        const identifier = solidityKeccak256(
          ["string"],
          ["unhashedIdentifier"]
        );
        const canBeTransferred = true;
        // 1 week
        const resurrectionTime = BigNumber.from(
          Date.now() / 1000 + 60 * 60 * 24 * 7
        );
        const minShards = 2;

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
        const name = "Test Sarcophagus";
        const identifier = solidityKeccak256(
          ["string"],
          ["unhashedIdentifier"]
        );
        const canBeTransferred = true;
        // 1 week
        const resurrectionTime = BigNumber.from(
          Date.now() / 1000 + 60 * 60 * 24 * 7
        );
        const minShards = 2;

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
        const name = "Test Sarcophagus";
        const identifier = solidityKeccak256(
          ["string"],
          ["unhashedIdentifier"]
        );
        const canBeTransferred = true;
        // 1 week
        const resurrectionTime = BigNumber.from(
          Date.now() / 1000 + 60 * 60 * 24 * 7
        );
        const minShards = 2;

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
        const unnamedAccounts = await getUnnamedAccounts();

        const name = "Test Sarcophagus";
        const identifier = solidityKeccak256(
          ["string"],
          ["unhashedIdentifier"]
        );
        const canBeTransferred = true;
        // 1 week
        const resurrectionTime = BigNumber.from(
          Date.now() / 1000 + 60 * 60 * 24 * 7
        );
        const minShards = 2;

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

        await expect(tx).to.be.revertedWith("ArweaveArchaeologistNotInList");
      });
    });
  });

  describe("finalizeSarcophagus()", () => {
    let identifier: string;
    let arweaveTxId: string;
    let tx: ContractTransaction;
    let archaeologistFreeBond: BigNumber;
    let archaeologistCursedBond: BigNumber;
    let arweaveArchBalance: BigNumber;
    let arweaveArchFreeBond: BigNumber;
    let arweaveArchCursedBond: BigNumber;

    // Get the arweave archaeologist's balances
    before(async () => {
      // Get the arweave archaeologist's sarco balance
      arweaveArchBalance = await sarcoToken.balanceOf(
        arweaveArchaeologist.account
      );

      // Get the arweave archaeologist's free bond
      arweaveArchFreeBond = await viewStateFacet.getFreeBond(
        arweaveArchaeologist.account
      );

      // Get the arweave archaeologist's cursed bond
      arweaveArchCursedBond = await viewStateFacet.getCursedBond(
        arweaveArchaeologist.account
      );
    });

    // Get a random archaeologist's free and cursed bonds
    before(async () => {
      // Get the archaeologist's free bond
      archaeologistFreeBond = await viewStateFacet.getFreeBond(
        randomArchaeologist.account
      );

      // Get the archaeologist's cursed bond
      archaeologistCursedBond = await viewStateFacet.getCursedBond(
        randomArchaeologist.account
      );
    });

    context("Successful finalization", () => {
      // Initialize and finalize the sarcophagus
      before(async () => {
        identifier = await initializeSarcophagus();
        const signatures = await signMultiple(
          archaeologists.map((x) => x.signer),
          identifier
        );

        const {
          arweaveTxId: _arweaveTxId,
          signatureWithAccount: arweaveArchSig,
        } = await setupArweaveArchSig();

        arweaveTxId = _arweaveTxId;
        tx = await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveArchSig,
          arweaveTxId
        );
      });

      it("should finalize the sarcophagus successfully", async () => {
        const receipt = await tx.wait();
        expect(receipt.status).to.equal(1);
      });

      it("should store the arweave transaction id", async () => {
        const sarcophagusStored = await viewStateFacet.getSarcophagus(
          identifier
        );
        expect(sarcophagusStored.arweaveTxIds).to.contain(arweaveTxId);
      });

      it("should transfer the storage fee to the arweave archaeologist", async () => {
        // Get the arweave archaeologist's sarco token balance after finalization
        const arweaveArchBalanceBefore = await sarcoToken.balanceOf(
          arweaveArchaeologist.account
        );

        expect(arweaveArchBalanceBefore.sub(arweaveArchBalance)).to.equal(
          arweaveArchaeologist.storageFee
        );
      });

      it("should lock up an archaeologist's free bond", async () => {
        // Calculate the free bond of an archaeologist
        const bondAmount = randomArchaeologist.diggingFee.add(
          randomArchaeologist.bounty
        );

        const archaeologistFreeBondAfter = await viewStateFacet.getFreeBond(
          randomArchaeologist.account
        );

        const archaeologistCursedBondAfter = await viewStateFacet.getCursedBond(
          randomArchaeologist.account
        );

        // Check that the archaeologist's free bond afterward has descreased by the bond amount
        expect(archaeologistFreeBond.sub(bondAmount)).to.equal(
          archaeologistFreeBondAfter
        );

        // Check that the archaeologist's cursed bond has increased by the bond amount
        expect(archaeologistCursedBond.add(bondAmount)).to.equal(
          archaeologistCursedBondAfter
        );
      });

      it("should lock up the arweave archaeologist's free bond", async () => {
        const arweaveArchFreeBondAfter = await viewStateFacet.getFreeBond(
          arweaveArchaeologist.account
        );

        const arweaveArchCursedBondAfter = await viewStateFacet.getCursedBond(
          arweaveArchaeologist.account
        );

        // Check that the arweave archaeologist's free bond has decreased by the bond amount
        expect(
          arweaveArchFreeBond.sub(arweaveArchaeologist.diggingFee)
        ).to.equal(arweaveArchFreeBondAfter);

        // Check that the arweave archaeologist's cursed bond has increased by the bond amount
        expect(arweaveArchCursedBond.add(arweaveArchaeologist.bounty)).to.equal(
          arweaveArchCursedBondAfter
        );
      });

      it("should emit an event", async () => {
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

        // Set up the arweave archaeologist's signature
        const { arweaveTxId, signatureWithAccount: arweaveArchSig } =
          await setupArweaveArchSig();

        const tx = await embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            signatures,
            arweaveArchSig,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the embalmer is not making the transaction", async () => {
        // Initialize the sarcophagus
        const identifier = await initializeSarcophagus();

        // Each archaeologist signs the identifier
        const signatures = await signMultiple(
          archaeologists.map((x) => x.signer),
          identifier
        );

        // Set up the arweave archaeologist's signature
        const { arweaveTxId, signatureWithAccount: arweaveArchSig } =
          await setupArweaveArchSig();

        const tx = embalmerFacet
          .connect(signers[9])
          .finalizeSarcophagus(
            identifier,
            signatures,
            arweaveArchSig,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus has already been finalized", async () => {
        // Initialize the sarcophagus
        const identifier = await initializeSarcophagus();

        // Each archaeologist signs the identifier
        const signatures = await signMultiple(
          archaeologists.map((x) => x.signer),
          identifier
        );

        // Set up the arweave archaeologist's signature
        const { arweaveTxId, signatureWithAccount: arweaveArchSig } =
          await setupArweaveArchSig();

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
          .finalizeSarcophagus(
            identifier,
            signatures,
            arweaveArchSig,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("SarcophagusAlreadyFinalized");
      });

      it("should revert if the provided arweave transaction id is empty", async () => {
        // Initialize the sarcophagus
        const identifier = await initializeSarcophagus();

        // Each archaeologist signs the identifier
        const signatures = await signMultiple(
          archaeologists.map((x) => x.signer),
          identifier
        );

        // Set up the arweave archaeologist's signature
        const { arweaveTxId, signatureWithAccount: arweaveArchSig } =
          await setupArweaveArchSig();

        const tx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            signatures,
            arweaveArchSig,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("ArweaveTxIdEmpty");
      });
    });

    context("Signature reverts", () => {
      it("should revert if the incorrect number of archaeologists' signatures were provided", async () => {
        const identifier = await initializeSarcophagus();
        const signatures = await signMultiple(
          archaeologists.map((x) => x.signer),
          identifier
        );

        const {
          arweaveTxId: _arweaveTxId,
          signatureWithAccount: arweaveArchSig,
        } = await setupArweaveArchSig();

        const arweaveTxId = _arweaveTxId;
        const tx = await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveArchSig,
          arweaveTxId
        );

        await expect(tx).to.be.revertedWith(
          "IncorrectNumberOfArchaeologistSignatures"
        );
      });

      it("should revert if there are duplicate signatures", async () => {
        const identifier = await initializeSarcophagus();
        const signatures = await signMultiple(
          archaeologists.map((x) => x.signer),
          identifier
        );

        // Make the second signature the same as the first
        const newSignatures = signatures.slice();
        newSignatures[1] = newSignatures[0];

        const { arweaveTxId, signatureWithAccount: arweaveArchSig } =
          await setupArweaveArchSig();

        const tx = await embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(
            identifier,
            newSignatures,
            arweaveArchSig,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("SignatureListNotUnique");
      });

      it("should revert if any signature provided by a regular archaeologist is from the wrong archaeologist", async () => {
        const identifier = await initializeSarcophagus();

        // Get a false signer
        const falseSigner = signers[9];

        // Replace the last signer in the list of signers with falseSigner
        const newSigners = archaeologists.map((x) => x.signer).slice();
        newSigners[newSigners.length - 1] = falseSigner;

        const signatures = await signMultiple(newSigners, identifier);

        const { arweaveTxId, signatureWithAccount: arweaveArchSig } =
          await setupArweaveArchSig();

        // Finalize the sarcophagus with the new identifier
        const tx = embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveArchSig,
          arweaveTxId
        );

        await expect(tx).to.be.revertedWith("ArchaeologistNotOnSarcophagus");
      });

      it("should revert if any signature provided by a regular archaeologist is not of the sarcophagus identifier", async () => {
        const identifier = await initializeSarcophagus();

        // Create a false identifier
        const falseIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["falseIdentifier"]
        );

        // Use the correct archaeologist to sign a false identifier
        const falseSignature = await sign(
          archaeologists[0].signer,
          falseIdentifier,
          "bytes32"
        );

        // Add the correct archaeologist account
        const falseSigWithAccount = Object.assign(falseSignature, {
          account: archaeologists[0].account,
        });

        const signatures = await signMultiple(
          archaeologists.map((x) => x.signer),
          identifier
        );

        // Replace the first signature in the list of newSignatures with the false signature
        signatures[0] = falseSigWithAccount;

        const { arweaveTxId, signatureWithAccount: arweaveArchSig } =
          await setupArweaveArchSig();

        // Finalize the sarcophagus with the new identifier where one of the signatures is incorrect
        const tx = embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveArchSig,
          arweaveTxId
        );

        await expect(tx).to.be.revertedWith("SignatureFromWrongAccount");
      });

      it("should revert if the arweave archaeologist's signature is from the wrong archaeologist", async () => {
        const identifier = await initializeSarcophagus();

        // Sign the arweaveTxId with the wrong archaeologist
        const falseArweaveArch = signers[6];
        const falseArweaveSignature = await sign(
          falseArweaveArch,
          arweaveTxId,
          "string"
        );

        const signatures = await signMultiple(
          archaeologists.map((x) => x.signer),
          identifier
        );

        // Finalize the sarcophagus where the arweaveSignature is signed by the wrong signer
        const tx = embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          falseArweaveSignature,
          arweaveTxId
        );

        await expect(tx).to.be.revertedWith("SignatureFromWrongAccount");
      });

      it("should revert if the arweave archaeologist's signature is not a signature of the arweave transaction id", async () => {
        const identifier = await initializeSarcophagus();

        const signatures = await signMultiple(
          archaeologists.map((x) => x.signer),
          identifier
        );

        // Use the correct arweave archaeologist to sign a false arweaveTxId
        const falseArweaveSignature = await sign(
          arweaveArchaeologist.signer,
          "falseArweaveTxId",
          "string"
        );

        // Finalize the sarcophagus where the signature is of the wrong data
        const tx = embalmerFacet.finalizeSarcophagus(
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
    let sarcoToken: SarcoTokenMock;
    let arweaveSignature: Signature;
    let diamondAddress: string;

    const arweaveTxId = "someArweaveTxId";

    // Deploy the contracts
    before(async () => {
      await deployments.fixture();
      sarcoToken = await ethers.getContract("SarcoTokenMock");
      diamondAddress = (await ethers.getContract("Diamond_DiamondProxy"))
        .address;

      embalmerFacet = await ethers.getContractAt(
        "EmbalmerFacet",
        diamondAddress
      );

      // Get the archaeologistFacet so we can add some free bond for the archaeologists
      archaeologistFacet = await ethers.getContractAt(
        "ArchaeologistFacet",
        diamondAddress
      );

      viewStateFacet = await ethers.getContractAt(
        "ViewStateFacet",
        diamondAddress
      );

      await setupArchaeologists(
        archaeologistFacet,
        archaeologists,
        diamondAddress,
        embalmer,
        sarcoToken
      );

      arweaveSignature = await sign(
        arweaveArchaeologist,
        arweaveTxId,
        "string"
      );
    });

    context("Successful rewrap", () => {
      it("should store the new resurrection time", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldStoreResurrectionTime",
          archaeologists
        );

        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Define a new resurrection time one week in the future
        const newResurrectionTime = BigNumber.from(
          Date.now() + 60 * 60 * 24 * 7 * 1000
        );

        // Rewrap the sarcophagus
        await embalmerFacet.rewrapSarcophagus(identifier, newResurrectionTime);

        const sarcophagusStored = await viewStateFacet.getSarcophagus(
          identifier
        );

        expect(sarcophagusStored.resurrectionTime).to.equal(
          newResurrectionTime.toString()
        );
      });

      it("should store the new resurrection window", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldStoreResurrectionWindow",
          archaeologists
        );

        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Define a new resurrection time one week in the future
        const newResurrectionTime = BigNumber.from(
          Date.now() + 60 * 60 * 24 * 7 * 1000
        );

        const sarcophagusStoredBefore = await viewStateFacet.getSarcophagus(
          identifier
        );

        // Rewrap the sarcophagus
        await embalmerFacet.rewrapSarcophagus(identifier, newResurrectionTime);

        const sarcophagusStoredAfter = await viewStateFacet.getSarcophagus(
          identifier
        );

        expect(sarcophagusStoredAfter.resurrectionWindow).to.not.equal(
          sarcophagusStoredBefore.resurrectionWindow
        );
      });

      it("should transfer the digging fees to the archaeologists", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldTransferDiggingFees",
          archaeologists
        );

        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        const archBalancesBefore = await getArchaeologistSarcoBalances(
          archaeologists,
          sarcoToken
        );

        // Define a new resurrection time one week in the future
        const newResurrectionTime = BigNumber.from(
          Date.now() + 60 * 60 * 24 * 7 * 1000
        );

        // Rewrap the sarcophagus
        await embalmerFacet.rewrapSarcophagus(identifier, newResurrectionTime);

        const archBalancesAfter = await getArchaeologistSarcoBalances(
          archaeologists,
          sarcoToken
        );

        // For each archaeologist, check that the difference in balances is equal to each archaeologist's digging fee
        for (let i = 0; i < archaeologists.length; i++) {
          const diggingFee = archaeologistsFees[i].diggingFee;
          expect(
            archBalancesAfter[i].balance
              .sub(archBalancesBefore[i].balance)
              .toString()
          ).to.equal(diggingFee.toString());
        }
      });

      it("should transfer the digging fee sum plus the protocol fee from the embalmer to the contract", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldTransferFeesFromEmbalmer",
          archaeologists
        );

        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Get the embalmer's sarco balance before rewrap
        const embalmerSarcoBalanceBefore = await sarcoToken.balanceOf(
          embalmer.address
        );

        // Define a new resurrection time one week in the future
        const newResurrectionTime = BigNumber.from(
          Date.now() + 60 * 60 * 24 * 7 * 1000
        );

        // Rewrap the sarcophagus
        await embalmerFacet.rewrapSarcophagus(identifier, newResurrectionTime);

        // Get the embalmer's sarco balance after rewrap
        const embalmerSarcoBalanceAfter = await sarcoToken.balanceOf(
          embalmer.address
        );

        // Calculate the sum of digging fees from archaeologistFees
        const diggingFeeSum = archaeologistsFees.reduce(
          (acc, cur) => acc.add(cur.diggingFee),
          BigNumber.from(0)
        );

        const protocolFee = process.env.PROTOCOL_FEE || "0";

        // Check that the difference in balances is equal to the sum of digging fees
        expect(
          embalmerSarcoBalanceBefore.sub(embalmerSarcoBalanceAfter).toString()
        ).to.equal(diggingFeeSum.add(BigNumber.from(protocolFee)).toString());
      });

      it("should collect protocol fees", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldCollectProtocolFees",
          archaeologists
        );

        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Define a new resurrection time one week in the future
        const newResurrectionTime = BigNumber.from(
          Date.now() + 60 * 60 * 24 * 7 * 1000
        );

        // Get the protocol fee amount
        const protocolFee = await viewStateFacet.getProtocolFeeAmount();

        // Get the total protocol fees before rewrap
        const totalProtocolFeesBefore =
          await viewStateFacet.getTotalProtocolFees();

        // Get the balance of the contract before rewrap
        const contractBalanceBefore = await sarcoToken.balanceOf(
          diamondAddress
        );

        // Rewrap the sarcophagus
        await embalmerFacet.rewrapSarcophagus(identifier, newResurrectionTime);

        // Get the total protocol fees after rewrap
        const totalProtocolFeesAfter =
          await viewStateFacet.getTotalProtocolFees();

        // Get the balance of the contract after rewrap
        const contractBalanceAfter = await sarcoToken.balanceOf(diamondAddress);

        // Check that the difference in total protocol fees is equal to the protocol fee amount
        expect(
          totalProtocolFeesAfter.sub(totalProtocolFeesBefore).toString()
        ).to.equal(protocolFee.toString());

        // Check that the difference in contract balance is equal to the protocol fee amount
        expect(
          contractBalanceAfter.sub(contractBalanceBefore).toString()
        ).to.equal(protocolFee.toString());
      });

      it("should emit an event", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldEmitAnEvent",
          archaeologists
        );

        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Define a new resurrection time one week in the future
        const newResurrectionTime = BigNumber.from(
          Date.now() + 60 * 60 * 24 * 7 * 1000
        );

        // Rewrap the sarcophagus
        const tx = await embalmerFacet.rewrapSarcophagus(
          identifier,
          newResurrectionTime
        );

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
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "senderIsNotEmbalmer",
          archaeologists
        );

        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

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
        const falseIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["falseIdentifier"]
        );

        // Define a new resurrection time one week in the future
        const newResurrectionTime = BigNumber.from(
          Date.now() + 60 * 60 * 24 * 7 * 1000
        );

        // Rewrap the sarcophagus
        const tx = embalmerFacet
          .connect(embalmer)
          .rewrapSarcophagus(falseIdentifier, newResurrectionTime);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sarcophagus is not finalized", async () => {
        const { identifier } = await createSarcophagusAndSignatures(
          "sarcophagusIsNotFinalized",
          archaeologists
        );

        // Define a new resurrection time one week in the future
        const newResurrectionTime = BigNumber.from(
          Date.now() + 60 * 60 * 24 * 7 * 1000
        );

        // Rewrap the sarcophagus
        const tx = embalmerFacet.rewrapSarcophagus(
          identifier,
          newResurrectionTime
        );

        await expect(tx).to.be.revertedWith("SarcophagusNotFinalized");
      });

      it("should revert if the new resurrection time is not in the future", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "newResTimeNotInFuture",
          archaeologists
        );

        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Define a new resurrection time not in the future
        const newResurrectionTime = BigNumber.from(
          (Date.now() / 1000).toFixed(0)
        );

        // Rewrap the sarcophagus
        const tx = embalmerFacet.rewrapSarcophagus(
          identifier,
          newResurrectionTime
        );

        await expect(tx).to.be.revertedWith("NewResurrectionTimeInPast");
      });
    });
  });

  describe("cancelSarcophagus()", () => {
    let sarcoToken: SarcoTokenMock;

    // Deploy the contracts
    before(async () => {
      await deployments.fixture();
      sarcoToken = await ethers.getContract("SarcoTokenMock");
      const diamondAddress = (await ethers.getContract("Diamond_DiamondProxy"))
        .address;

      embalmerFacet = await ethers.getContractAt(
        "EmbalmerFacet",
        diamondAddress
      );

      // Get the archaeologistFacet so we can add some free bond for the archaeologists
      archaeologistFacet = await ethers.getContractAt(
        "ArchaeologistFacet",
        diamondAddress
      );

      viewStateFacet = await ethers.getContractAt(
        "ViewStateFacet",
        diamondAddress
      );

      await setupArchaeologists(
        archaeologistFacet,
        archaeologists,
        diamondAddress,
        embalmer,
        sarcoToken
      );
    });

    context("Successful cancel", () => {
      it("should cancel the sarcophagus successfully", async () => {
        const { identifier } = await createSarcophagusAndSignatures(
          "successfulCancelSarcophagus",
          archaeologists
        );

        const tx = await embalmerFacet
          .connect(embalmer)
          .cancelSarcophagus(identifier);

        const receipt = await tx.wait();

        expect(receipt.status).to.equal(1);
      });

      it("should set the sarcophagus state to done", async () => {
        const { identifier } = await createSarcophagusAndSignatures(
          "shouldSetSarcophagusStateToDone",
          archaeologists
        );

        await embalmerFacet.connect(embalmer).cancelSarcophagus(identifier);

        const sarcophagus = await viewStateFacet.getSarcophagus(identifier);

        expect(sarcophagus.state).to.equal(SarcophagusState.Done);
      });

      it("should transfer total fees back to the embalmer", async () => {
        // Get the sarco balance of the embalmer before canceling the sarcophagus
        const sarcoBalanceBefore = await sarcoToken.balanceOf(embalmer.address);

        const { identifier } = await createSarcophagusAndSignatures(
          "shouldTransferBackFees",
          archaeologists
        );

        embalmerFacet.connect(embalmer).cancelSarcophagus(identifier);

        // Get the sarco balance of the embalmer after canceling the sarcophagus
        const sarcoBalanceAfter = await sarcoToken.balanceOf(embalmer.address);

        expect(sarcoBalanceBefore.toString()).to.equal(
          sarcoBalanceAfter.toString()
        );
      });

      it("should emit an event", async () => {
        const { identifier } = await createSarcophagusAndSignatures(
          "shouldEmitEvent",
          archaeologists
        );

        const tx = await embalmerFacet
          .connect(embalmer)
          .cancelSarcophagus(identifier);

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
        const { identifier } = await createSarcophagusAndSignatures(
          "senderIsNotEmbalmer",
          archaeologists
        );

        const tx = embalmerFacet
          .connect(archaeologists[0])
          .cancelSarcophagus(identifier);

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus does not exist", async () => {
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
        const arweaveTxId = "someArweaveTxId";
        const arweaveSignature = await sign(
          arweaveArchaeologist,
          arweaveTxId,
          "string"
        );

        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "sarcophagusAlraedyFinalized",
          archaeologists
        );

        // finalize the sarcophagus
        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        const tx = embalmerFacet.cancelSarcophagus(identifier);

        await expect(tx).to.be.revertedWith("SarcophagusAlreadyFinalized");
      });
    });
  });

  describe("burySarcophagus()", () => {
    let sarcoToken: SarcoTokenMock;
    let arweaveSignature: Signature;

    const arweaveTxId = "someArweaveTxId";

    // Deploy the contracts
    before(async () => {
      await deployments.fixture();
      sarcoToken = await ethers.getContract("SarcoTokenMock");
      const diamondAddress = (await ethers.getContract("Diamond_DiamondProxy"))
        .address;

      embalmerFacet = await ethers.getContractAt(
        "EmbalmerFacet",
        diamondAddress
      );

      // Get the archaeologistFacet so we can add some free bond for the archaeologists
      archaeologistFacet = await ethers.getContractAt(
        "ArchaeologistFacet",
        diamondAddress
      );

      viewStateFacet = await ethers.getContractAt(
        "ViewStateFacet",
        diamondAddress
      );

      await setupArchaeologists(
        archaeologistFacet,
        archaeologists,
        diamondAddress,
        embalmer,
        sarcoToken
      );

      arweaveSignature = await sign(
        arweaveArchaeologist,
        arweaveTxId,
        "string"
      );
    });

    context("Successful bury", () => {
      it("should set resurrection time to inifinity", async () => {
        // Initialize a sarcophagus
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldSetResurrectionTimeToInfinity",
          archaeologists
        );

        // Finalize the sarcophagus
        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Bury the sarcophagus
        await embalmerFacet.burySarcophagus(identifier);

        const sarcophagus = await viewStateFacet.getSarcophagus(identifier);

        expect(sarcophagus.resurrectionTime).to.equal(
          ethers.constants.MaxUint256
        );
      });

      it("should set the sarcophagus state to done", async () => {
        // Initialize a sarcophagus
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldSetStateToDone",
          archaeologists
        );

        // Finalize the sarcophagus
        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Bury the sarcophagus
        await embalmerFacet.burySarcophagus(identifier);

        const sarcophagus = await viewStateFacet.getSarcophagus(identifier);

        expect(sarcophagus.state).to.equal(SarcophagusState.Done);
      });

      it("should free the archaeologist's bond", async () => {
        // Get the free and cursed bond before
        const freeBondBefore = await viewStateFacet.getFreeBond(
          archaeologists[0].address
        );
        const cursedBondBefore = await viewStateFacet.getCursedBond(
          archaeologists[0].address
        );

        // Initialize a sarcophagus
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldFreeArchBond",
          archaeologists
        );

        // Finalize the sarcophagus
        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Bury the sarcophagus
        await embalmerFacet.burySarcophagus(identifier);

        // Get the free and cursed bond after bury
        const freeBondAfter = await viewStateFacet.getFreeBond(
          archaeologists[0].address
        );
        const cursedBondAfter = await viewStateFacet.getCursedBond(
          archaeologists[0].address
        );

        expect(freeBondAfter.toString()).to.equal(freeBondBefore.toString());

        expect(cursedBondAfter.toString()).to.equal(
          cursedBondBefore.toString()
        );
      });

      it("should transfer digging fees to each archaeologist", async () => {
        // Initialize a sarcophagus
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldTransferDigginFees",
          archaeologists
        );

        // Finalize the sarcophagus
        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Get the archaeologist's sarco balance before bury
        const sarcoBalanceBefore = await sarcoToken.balanceOf(
          archaeologists[0].address
        );

        // Bury the sarcophagus
        await embalmerFacet.burySarcophagus(identifier);

        // Get the archaeologist sarco balance after bury
        const sarcoBalanceAfter = await sarcoToken.balanceOf(
          archaeologists[0].address
        );

        // Get the archaeologist's digging fees with the archaeologist address
        const diggingFee = archaeologistsFees[0].diggingFee;

        // Check that the difference in balances is equal to the digging fee
        expect(sarcoBalanceAfter.sub(sarcoBalanceBefore).toString()).to.equal(
          diggingFee.toString()
        );
      });

      it("should transfer the bounty back to the embalmer", async () => {
        // Initialize a sarcophagus
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldTransferBountyToEmbalmer",
          archaeologists
        );

        // Finalize the sarcophagus
        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Get the archaeologist's sarco balance before bury
        const sarcoBalanceBefore = await sarcoToken.balanceOf(embalmer.address);

        // Bury the sarcophagus
        await embalmerFacet.burySarcophagus(identifier);

        // Get the archaeologist sarco balance after bury
        const sarcoBalanceAfter = await sarcoToken.balanceOf(embalmer.address);

        // Add the bounties in archaeologist fees
        const totalBounty = archaeologistsFees.reduce(
          (acc, cur) => acc.add(cur.bounty),
          ethers.constants.Zero
        );

        // Check that the difference in balances is equal to the total bounty
        expect(sarcoBalanceAfter.sub(sarcoBalanceBefore).toString()).to.equal(
          totalBounty.toString()
        );
      });

      it("should emit an event", async () => {
        // Initialize a sarcophagus
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "shouldEmitEvent",
          archaeologists
        );

        // Finalize the sarcophagus
        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Bury the sarcophagus
        const tx = await embalmerFacet.burySarcophagus(identifier);

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
        // Initialize a sarcophagus
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "senderIsNotEmbalmer",
          archaeologists
        );

        // Finalize the sarcophagus
        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Bury the sarcophagus
        const tx = embalmerFacet
          .connect(signers[8])
          .burySarcophagus(identifier);

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus does not exist", async () => {
        const falseIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["falseIdentifier"]
        );

        const tx = embalmerFacet.burySarcophagus(falseIdentifier);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sarcophagus is not finalized", async () => {
        // Initialize a sarcophagus
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "sarcophagusNotFinalized",
          archaeologists
        );

        // Bury the sarcophagus
        const tx = embalmerFacet.burySarcophagus(identifier);

        await expect(tx).to.be.revertedWith("SarcophagusNotFinalized");
      });
    });
  });
});
