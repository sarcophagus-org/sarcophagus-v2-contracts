import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import { BigNumber, ContractTransaction, Signature } from "ethers";
import { ethers } from "hardhat";
import { deployDiamond } from "../../scripts/deploy-diamond";
import { ArchaeologistFacet, SarcoTokenMock } from "../../typechain";
import { EmbalmerFacet } from "../../typechain/EmbalmerFacet";
import { SignatureWithAccount } from "../../types";
import { sign } from "../utils/helpers";

describe("Contract: EmbalmerFacet", () => {
  // Set up some values to be used in the tests
  const firstArchaeologistBounty = 100;
  const firstArchaeologistDiggingFee = 10;

  // Define a resurrrection time one week in the future
  const resurrectionTimeInFuture = BigNumber.from(
    Date.now() + 60 * 60 * 24 * 7
  );

  // Generate a hash from the name to use as the identifier. It doesn't
  // matter what the hash is of for the tests.
  const identifier = ethers.utils.solidityKeccak256(
    ["string"],
    ["sarcophagusIdentifier"]
  );

  let embalmerFacet: EmbalmerFacet;
  let archaeologistFacet: ArchaeologistFacet;
  let embalmer: SignerWithAddress;
  let archaeologists: SignerWithAddress[];
  let recipient: SignerWithAddress;
  let arweaveArchaeologist: SignerWithAddress;
  let sarcoToken: SarcoTokenMock;
  let signers: SignerWithAddress[];

  // Define an arcaeologist fees object to be used in any test that needs it
  const archaeologistsFees = [
    {
      storageFee: 20,
      diggingFee: 10,
      bounty: 100,
    },
    {
      storageFee: 25,
      diggingFee: 8,
      bounty: 112,
    },
    {
      storageFee: 21,
      diggingFee: 9,
      bounty: 105,
    },
  ];

  // Set up the signers for the tests
  before(async () => {
    signers = await ethers.getSigners();

    // Set some roles to be used in the tests
    embalmer = signers[0];
    archaeologists = [signers[1], signers[2], signers[3]];
    arweaveArchaeologist = signers[1];
    recipient = signers[4];
  });

  /**
   * Creates a sarcophagus. This is helpful in several places
   * throughout the tests where a sarcophagus should be initialized
   * successfully.
   */
  const initializeSarcophagus = async (
    name: string,
    resurrectionTime: BigNumber,
    identifier: string,
    archaeologists: any[],
    minShards?: number
  ): Promise<ContractTransaction> => {
    // Define archaeologist objects to be passed into the sarcophagus
    const archaeologistObjects = archaeologists.map((a, i) => ({
      archAddress: a.address,
      storageFee: BigNumber.from(archaeologistsFees[i].storageFee),
      diggingFee: BigNumber.from(archaeologistsFees[i].diggingFee),
      bounty: BigNumber.from(archaeologistsFees[i].bounty),
      hashedShard: ethers.utils.solidityKeccak256(["string"], [a.address]),
    }));

    const canBeTransfered = true;

    // Create a sarcophagus as the embalmer
    const tx = await embalmerFacet
      .connect(embalmer)
      .initializeSarcophagus(
        name,
        identifier,
        archaeologistObjects,
        arweaveArchaeologist.address,
        recipient.address,
        resurrectionTime,
        canBeTransfered,
        minShards || 3
      );

    return tx;
  };

  const setupArchaeologists = async (
    archaeologistFacet: ArchaeologistFacet,
    archaeologists: SignerWithAddress[],
    diamondAddress: string,
    embalmer: SignerWithAddress,
    sarcoToken: SarcoTokenMock
  ): Promise<void> => {
    // Approve the embalmer on the sarco token so transferFrom will work
    await sarcoToken
      .connect(embalmer)
      .approve(diamondAddress, ethers.constants.MaxUint256);

    for (const archaeologist of archaeologists) {
      // Transfer 10,000 sarco tokens to each archaeologist to be put into free
      // bond
      await sarcoToken.transfer(archaeologist.address, BigNumber.from(10_000));

      // Approve the archaeologist on the sarco token so transferFrom will work
      await sarcoToken
        .connect(archaeologist)
        .approve(diamondAddress, ethers.constants.MaxUint256);

      // Deposit some free bond to the contract so initializeSarcophagus will
      // work
      await archaeologistFacet
        .connect(archaeologist)
        .depositFreeBond(
          archaeologist.address,
          BigNumber.from("1000"),
          sarcoToken.address
        );
    }
  };

  /**
   * Gets a list of archaeologist signatures for the given list of accounts.
   *
   * @param archaeologists The list of accounts that will be used to sign the
   * sarcophagus
   * @returns
   */
  const getArchaeologistSignatures = async (
    archaeologists: SignerWithAddress[],
    arweaveArchaeologist: SignerWithAddress,
    identifier: string
  ): Promise<SignatureWithAccount[]> => {
    const signatures: SignatureWithAccount[] = [];

    for (const archaeologist of archaeologists) {
      // Sign a message and add to signatures. Only sign if the archaeologist
      // is not the arweave archaeologist
      if (archaeologist.address !== arweaveArchaeologist.address) {
        const signature = await sign(archaeologist, identifier, "bytes32");

        signatures.push(
          Object.assign(signature, { account: archaeologist.address })
        );
      }
    }

    return signatures;
  };

  /**
   * Creates a new sarcophagus and signatures for the cancelSarcophaguse tests
   * @param unhashedIdentifier
   * @param archaeologists
   * @returns
   */
  const createSarcophagusAndSignatures = async (
    unhashedIdentifier: string,
    archaeologists: any[]
  ): Promise<{
    identifier: string;
    signatures: SignatureWithAccount[];
  }> => {
    // Create a new identifier
    const newIdentifier = ethers.utils.solidityKeccak256(
      ["string"],
      [unhashedIdentifier]
    );

    // Initialize the sarcophagus with the new identifier
    await initializeSarcophagus(
      "New Test Sarcophagus",
      resurrectionTimeInFuture,
      newIdentifier,
      archaeologists
    );

    // Get new signatures from the archaeologists of the new identifier
    const newSignatures = await getArchaeologistSignatures(
      archaeologists,
      arweaveArchaeologist,
      newIdentifier
    );

    return { identifier: newIdentifier, signatures: newSignatures };
  };

  describe("initializeSarcophagus()", () => {
    // Deploys the entire diamond before each test.
    // This is necessary so that each test will start in a clean state.
    beforeEach(async () => {
      // Deploy the sarco token contract

      const { diamondAddress, sarcoToken: _sarcoToken } = await deployDiamond();

      // Set sarcoToken globally
      sarcoToken = _sarcoToken;

      embalmerFacet = await ethers.getContractAt(
        "EmbalmerFacet",
        diamondAddress
      );

      // Get the archaeologistFacet so we can add some free bond for the archaeologists
      archaeologistFacet = await ethers.getContractAt(
        "ArchaeologistFacet",
        diamondAddress
      );

      for (const archaeologist of archaeologists) {
        // Transfer 10,000 sarco tokens to each archaeologist to be put into free
        // bond
        await _sarcoToken.transfer(
          archaeologist.address,
          BigNumber.from(10_000)
        );

        // Approve the archaeologist on the sarco token so transferFrom will work
        await _sarcoToken
          .connect(archaeologist)
          .approve(diamondAddress, ethers.constants.MaxUint256);

        // Approve the embalmer on the sarco token so transferFrom will work
        await _sarcoToken
          .connect(embalmer)
          .approve(diamondAddress, ethers.constants.MaxUint256);

        // Deposit some free bond to the contract so initializeSarcophagus will
        // work
        await archaeologistFacet
          .connect(archaeologist)
          .depositFreeBond(
            archaeologist.address,
            BigNumber.from("1000"),
            _sarcoToken.address
          );
      }
    });

    it("should successfully create sarcophagus", async () => {
      const tx = await initializeSarcophagus(
        "Test Sarcophagus",
        resurrectionTimeInFuture,
        identifier,
        archaeologists
      );
      const receipt = await tx.wait();

      expect(receipt.status).to.equal(1);
    });

    it("should revert when creating a sarcophagus that already exists", async () => {
      await initializeSarcophagus(
        "Test Sarcophagus",
        resurrectionTimeInFuture,
        identifier,
        archaeologists
      );

      // Try to create the same sarcophagus again
      await expect(
        initializeSarcophagus(
          "Test Sarcophagus",
          resurrectionTimeInFuture,
          identifier,
          archaeologists
        )
      ).to.be.revertedWith("SarcophagusAlreadyExists");
    });

    it("should revert if the resurrection time is not in the future", () => {
      expect(
        initializeSarcophagus(
          "Test Sarcophagus",
          BigNumber.from((Date.now() / 1000).toFixed(0)),
          identifier,
          archaeologists
        )
      ).to.be.revertedWith("ResurrectionTimeInPast");
    });

    it("should revert if no archaeologists are provided", async () => {
      expect(
        initializeSarcophagus(
          "Test Sarcophagus",
          BigNumber.from((Date.now() / 1000).toFixed(0)),
          identifier,
          []
        )
      ).to.be.revertedWith("NoArchaeologistsProvided");
    });

    it("should revert if the list of archaeologists is not unique", async () => {
      const nonUniqueArchaeologists = archaeologists.slice();
      const firstArchaeologist = archaeologists[0];
      nonUniqueArchaeologists.push(firstArchaeologist);

      expect(
        initializeSarcophagus(
          "Test Sarcophagus",
          resurrectionTimeInFuture,
          identifier,
          archaeologists
        )
      ).to.be.revertedWith("ArchaeologistListNotUnique");
    });

    it("should revert if minShards is greater than the number of archaeologists", async () => {
      expect(
        initializeSarcophagus(
          "Test Sarcophagus",
          BigNumber.from((Date.now() / 1000).toFixed(0)),
          identifier,
          archaeologists,
          5
        )
      ).to.be.revertedWith("MinShardsGreaterThanArchaeologists");
    });

    it("should revert if minShards is 0", async () => {
      expect(
        initializeSarcophagus(
          "Test Sarcophagus",
          BigNumber.from((Date.now() / 1000).toFixed(0)),
          identifier,
          archaeologists,
          0
        )
      ).to.be.revertedWith("MinShardsZero");
    });

    it("should revert if an archaeologist does not have enough free bond", async () => {
      const freeBond = await archaeologistFacet.getFreeBond(
        archaeologists[0].address
      );

      // Connect with the first archaeologist and withdraw the freeBond amount
      // The first archaeologist's free bond balance should now be 0
      await archaeologistFacet
        .connect(archaeologists[0])
        .withdrawFreeBond(
          archaeologists[0].address,
          freeBond,
          sarcoToken.address
        );

      // Initalize the sarcophagus and expect it to revert
      return expect(
        initializeSarcophagus(
          "Test Sarcophagus",
          resurrectionTimeInFuture,
          identifier,
          archaeologists
        )
      ).to.be.revertedWith("NotEnoughFreeBond");
    });

    it("should lock up an archaeologist's free bond", async () => {
      // TODO: Modify this when the calculateCursedBond method changes in the contract
      const firstArchaeologistCursedBond =
        firstArchaeologistBounty + firstArchaeologistDiggingFee;

      // Get the free and cursed bond before and after, then compare them
      const freeBondBefore = await archaeologistFacet.getFreeBond(
        archaeologists[0].address
      );
      const cursedBondBefore = await archaeologistFacet.getCursedBond(
        archaeologists[0].address
      );

      await initializeSarcophagus(
        "Test Sarcophagus",
        resurrectionTimeInFuture,
        identifier,
        archaeologists
      );

      const freeBondAfter = await archaeologistFacet.getFreeBond(
        archaeologists[0].address
      );
      const cursedBondAfter = await archaeologistFacet.getCursedBond(
        archaeologists[0].address
      );

      expect(freeBondBefore.sub(freeBondAfter)).to.equal(
        BigNumber.from(firstArchaeologistCursedBond)
      );
      expect(cursedBondAfter.sub(cursedBondBefore)).to.equal(
        BigNumber.from(firstArchaeologistCursedBond)
      );
    });

    it("should transfer fees in sarco token from the embalmer to the contract", async () => {
      // Get the embalmer's sarco token balance before and after, then compare
      const embalmerBalanceBefore = await sarcoToken.balanceOf(
        embalmer.address
      );

      await initializeSarcophagus(
        "Test Sarcophagus",
        resurrectionTimeInFuture,
        identifier,
        archaeologists
      );

      const embalmerBalanceAfter = await sarcoToken.balanceOf(embalmer.address);

      // Find the arweave archaeologist and get their storage fee amount
      const arweaveArchaeologistIndex = archaeologists.findIndex(
        (a) => a.address === arweaveArchaeologist.address
      );
      const arweaveArchaeologistStorageFee = BigNumber.from(
        archaeologistsFees[arweaveArchaeologistIndex].storageFee
      );
      const arweaveArchaeologistStorageFeeInt =
        arweaveArchaeologistStorageFee.toNumber();

      // Calculate the total fees:
      // The arweaver archaeologist's storage fee + all bounties + all digging
      // fees
      const totalFees =
        archaeologistsFees.reduce(
          (acc, fee) => acc + fee.bounty + fee.diggingFee,
          0
        ) + arweaveArchaeologistStorageFeeInt;

      expect(embalmerBalanceBefore.sub(embalmerBalanceAfter)).to.equal(
        BigNumber.from(totalFees)
      );
    });

    it("should emit an event on initialize", async () => {
      const tx = await initializeSarcophagus(
        "Test Sarcophagus",
        resurrectionTimeInFuture,
        identifier,
        archaeologists
      );
      const receipt = await tx.wait();

      const events = receipt.events!;
      expect(events).to.not.be.undefined;

      // Check that the list of events includes an event that has an address
      // matching the embalmerFacet address
      expect(events.some((event) => event.address === embalmerFacet.address)).to
        .be.true;
    });
  });

  describe("finalizeSarcophagus()", () => {
    const arweaveTxId: string = "arweave-transaction-id";

    let signatures: SignatureWithAccount[];
    let diamondAddress: string;
    let arweaveSignature: Signature;

    // Deploy the contracts
    before(async () => {
      const { diamondAddress: _diamondAddress, sarcoToken: _sarcoToken } =
        await deployDiamond();
      diamondAddress = _diamondAddress;
      sarcoToken = _sarcoToken;

      embalmerFacet = await ethers.getContractAt(
        "EmbalmerFacet",
        diamondAddress
      );

      // Get the archaeologistFacet so we can add some free bond for the archaeologists
      archaeologistFacet = await ethers.getContractAt(
        "ArchaeologistFacet",
        diamondAddress
      );
    });

    // Set up the archaeologists
    before(async () => {
      await setupArchaeologists(
        archaeologistFacet,
        archaeologists,
        diamondAddress,
        embalmer,
        sarcoToken
      );

      // Get regular archaeologist signatures. This excludes the arweave archaeologist.
      signatures = await getArchaeologistSignatures(
        archaeologists,
        arweaveArchaeologist,
        identifier
      );

      // For the arweave archaeologist, sign the arweave transaction id
      arweaveSignature = await sign(
        arweaveArchaeologist,
        arweaveTxId,
        "string"
      );
    });

    // Initialize the sarcophagus so finalize will work
    before(async () => {
      await initializeSarcophagus(
        "Test Sarcophagus",
        resurrectionTimeInFuture,
        identifier,
        archaeologists
      );
    });

    context("Successful finalization", () => {
      let tx: ContractTransaction;
      let arweaveArchSarcoBalanceBefore: BigNumber;

      // Finalize the sarcophagus only once for all success tests
      before(async () => {
        // Get the arweave archaeologist's sarco balance before finalization
        arweaveArchSarcoBalanceBefore = await sarcoToken.balanceOf(
          arweaveArchaeologist.address
        );

        tx = await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );
      });

      it("should finalize the sarcophagus successfully", async () => {
        const receipt = await tx.wait();
        expect(receipt.status).to.equal(1);
      });

      it("should store the arweave transaction id", async () => {
        // TODO: Write view function that gets the arweave transaction id from the sarcophagus
      });

      it("should transfer the storage fee to the arweave archaeologist", async () => {
        // Get the storage fee of the arweave archaeologist
        const arweaveArchaeologistIndex = archaeologists.findIndex(
          (a) => a.address === arweaveArchaeologist.address
        );
        const arweaveArchaeologistStorageFee = BigNumber.from(
          archaeologistsFees[arweaveArchaeologistIndex].storageFee
        );

        // Get the arweave archaeologist's sarco token balance after finalization
        const arweaveArchSarcoBalanceAfter = await sarcoToken.balanceOf(
          arweaveArchaeologist.address
        );

        // Check that the arweave archaeologist's
        // sarco token balance after - sarco token balance before = storage fee
        expect(
          arweaveArchSarcoBalanceAfter.sub(arweaveArchSarcoBalanceBefore)
        ).to.equal(arweaveArchaeologistStorageFee);
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
      beforeEach(async () => {});
      it("should revert if the sarcophagus does not exist", async () => {
        // Recall that the identifier is a hash
        const fakeIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["someFakeIdentifier"]
        );

        const tx = embalmerFacet.finalizeSarcophagus(
          fakeIdentifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the embalmer is not making the transaction", async () => {
        const tx = embalmerFacet
          .connect(archaeologists[0])
          .finalizeSarcophagus(
            identifier,
            signatures,
            arweaveSignature,
            arweaveTxId
          );

        await expect(tx).to.be.revertedWith("SenderNotEmbalmer");
      });

      it("should revert if the sarcophagus has already been finalized", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "alreadyFinalized",
          archaeologists
        );

        // Finalize the sarcophagus with the new identifier
        await embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        // Finalize the sarcophagus with the new identifier again and expect revert
        const tx = embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        await expect(tx).to.be.revertedWith("SarcophagusAlreadyFinalized");
      });

      it("should revert if the provided arweave transaction id is empty", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "transactionIdEmpty",
          archaeologists
        );

        // Finalize the sarcophagus with the new identifier
        const tx = embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          ""
        );

        await expect(tx).to.be.revertedWith("ArweaveTxIdEmpty");
      });
    });

    context("Signature reverts", () => {
      it("should revert if the incorrect number of archaeologists' signatures were provided", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "incorrectNumberOfSignatures",
          archaeologists
        );

        // Finalize the sarcophagus with the new identifier
        const tx = embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures.slice(1),
          arweaveSignature,
          arweaveTxId
        );

        await expect(tx).to.be.revertedWith(
          "IncorrectNumberOfArchaeologistSignatures"
        );
      });

      it("should revert if any signature provided by a regular archaeologist is from the wrong archaeologist", async () => {
        // Create a new identifier
        const newIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["withIncorrectArchaeologist"]
        );

        // Initialize the sarcophagus with the new identifier
        await initializeSarcophagus(
          "New Test Sarcophagus",
          resurrectionTimeInFuture,
          newIdentifier,
          archaeologists
        );

        // Get a false archaeologist
        const falseArchaeologist = signers[6];

        // Replace the last archaeologist in the list of archaeologists with
        // falseArchaeologist
        const newArchaeologists = archaeologists.slice();
        newArchaeologists[newArchaeologists.length - 1] = falseArchaeologist;

        // Get new signatures from the archaeologists where one of them is false
        const newSignatures = await getArchaeologistSignatures(
          newArchaeologists,
          arweaveArchaeologist,
          newIdentifier
        );

        // Finalize the sarcophagus with the new identifier
        const tx = embalmerFacet.finalizeSarcophagus(
          newIdentifier,
          newSignatures,
          arweaveSignature,
          arweaveTxId
        );

        await expect(tx).to.be.revertedWith("ArchaeologistNotOnSarcophagus");
      });

      it("should revert if any signature provided by a regular archaeologist is not of the sarcophagus identifier", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "incorrectSignatures",
          archaeologists
        );

        // Create a false identifier
        const falseIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["falseIdentifier"]
        );

        // Use the correct archaeologist to sign a false identifier
        const falseSignature = await sign(
          archaeologists[0],
          falseIdentifier,
          "bytes32"
        );

        // Add the correct archaeologist account
        const falseSigWithAccount = Object.assign(falseSignature, {
          account: archaeologists[0].address,
        });

        // Replace the first signature in the list of newSignatures with the false signature
        signatures[0] = falseSigWithAccount;

        // Finalize the sarcophagus with the new identifier where one of the signatures is incorrect
        const tx = embalmerFacet.finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );

        await expect(tx).to.be.revertedWith("SignatureFromWrongAccount");
      });

      it("should revert if the arweave archaeologist's signature is from the wrong archaeologist", async () => {
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "sigFromWrongArchaeologist",
          archaeologists
        );

        // Sign the arweaveTxId with the wrong archaeologist
        const falseArweaveArch = signers[6];
        const falseArweaveSignature = await sign(
          falseArweaveArch,
          arweaveTxId,
          "string"
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
        const { identifier, signatures } = await createSarcophagusAndSignatures(
          "arweaveSigNotOfArweaveTxId",
          archaeologists
        );

        // Use the correct arweave archaeologist to sign a false arweaveTxId
        const falseArweaveSignature = await sign(
          arweaveArchaeologist,
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

  describe("cancelSarcophagus()", () => {
    let sarcoToken: SarcoTokenMock;

    // Deploy the contracts
    before(async () => {
      let diamondAddress: string;
      ({ diamondAddress, sarcoToken } = await deployDiamond());

      embalmerFacet = await ethers.getContractAt(
        "EmbalmerFacet",
        diamondAddress
      );

      // Get the archaeologistFacet so we can add some free bond for the archaeologists
      archaeologistFacet = await ethers.getContractAt(
        "ArchaeologistFacet",
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

        const tx = await embalmerFacet.cancelSarcophagus(identifier);

        const receipt = await tx.wait();

        expect(receipt.status).to.equal(1);
      });

      it("should set the sarcophagus state to done", async () => {
        // TODO: Write a view method to get the sarcophagus state
      });
      it("should unlock each archaeologist's cursed bond", async () => {
        // TODO: Write a view method to get the archaoelogists' cursed bond
      });

      it("should transfer total fees back to the embalmer", async () => {
        // Get the sarco balance of the embalmer before canceling the sarcophagus
        const sarcoBalanceBefore = await sarcoToken.balanceOf(embalmer.address);

        const { identifier } = await createSarcophagusAndSignatures(
          "shouldTransferBackFees",
          archaeologists
        );

        embalmerFacet.cancelSarcophagus(identifier);

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

        const tx = await embalmerFacet.cancelSarcophagus(identifier);

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

        expect(tx).to.be.revertedWith("SenderIsNotEmbalmer");
      });

      it("should revert if the sarcophagus does not exist", async () => {
        const falseIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["falseIdentifier"]
        );

        const tx = embalmerFacet.cancelSarcophagus(falseIdentifier);

        expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
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

        expect(tx).to.be.revertedWith("SarcophagusAlreadyFinalized");
      });
    });
  });
});
