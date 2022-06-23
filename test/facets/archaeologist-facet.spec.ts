import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import { BigNumber, Signature } from "ethers";
import { ethers } from "hardhat";
import { deployDiamond } from "../../scripts/deploy-diamond";
import {
  ArchaeologistFacet,
  EmbalmerFacet,
  SarcoTokenMock,
} from "../../typechain";
import { SignatureWithAccount } from "../../types";
import {
  increaseNextBlockTimestamp,
  setupArchaeologists,
  sign,
} from "../utils/helpers";

describe("Contract: ArchaeologistFacet", () => {
  let archaeologistFacet: ArchaeologistFacet;
  let archaeologist: SignerWithAddress;
  let sarcoToken: SarcoTokenMock;
  let archaeologistSarcBalance: BigNumber;
  let diamondAddress: string;

  // Deploy the contracts and do stuff before each function, not before each
  // test. There is no need to do all of this before every single test.
  const beforeEachFunc = async () => {
    const signers = await ethers.getSigners();

    archaeologist = signers[0];

    ({ diamondAddress, sarcoToken } = await deployDiamond());

    // Approve the archaeologist on the sarco token so transferFrom will work
    await sarcoToken
      .connect(archaeologist)
      .approve(diamondAddress, ethers.constants.MaxUint256);

    archaeologistFacet = await ethers.getContractAt(
      "ArchaeologistFacet",
      diamondAddress
    );

    // Get the archaeologist's sarco token balance. This is used throughout the
    // tests.
    archaeologistSarcBalance = await sarcoToken.balanceOf(
      archaeologist.address
    );
  };

  describe("depositFreeBond()", () => {
    before(beforeEachFunc);

    it("should deposit free bond to the contract", async () => {
      const tx = await archaeologistFacet.depositFreeBond(BigNumber.from(100));
      const receipt = await tx.wait();

      // Check that the transaction succeeded
      expect(receipt.status).to.equal(1);

      const freeBond = await archaeologistFacet.getFreeBond(
        archaeologist.address
      );
      expect(freeBond.toString()).to.equal("100");

      const sarcoTokenBalance = await sarcoToken.balanceOf(
        archaeologist.address
      );
      expect(sarcoTokenBalance.toString()).to.equal(
        archaeologistSarcBalance.sub(BigNumber.from(100)).toString()
      );

      const contractSarcBalance = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );
      expect(contractSarcBalance.toString()).to.equal("100");
    });

    it("should emit an event when the free bond is deposited", async () => {
      const tx = await archaeologistFacet.depositFreeBond(BigNumber.from(100));
      const receipt = await tx.wait();
      const events = receipt.events!;
      expect(events).to.not.be.undefined;

      // Check that the list of events includes an event that has an address
      // matching the archaeologistFacet address
      expect(
        events.some((event) => event.address === archaeologistFacet.address)
      ).to.be.true;
    });

    it("should emit a transfer event when the sarco token is transfered", async () => {
      const tx = await archaeologistFacet.depositFreeBond(BigNumber.from(100));
      const receipt = await tx.wait();
      const events = receipt.events!;
      expect(events).to.not.be.undefined;

      // Check that the list of events includes an event that has an address
      // matching the archaeologistFacet address
      expect(events.some((event) => event.address === sarcoToken.address)).to.be
        .true;
    });

    it("should revert if amount is negative", async () => {
      // Try to deposit a negative amount
      await expect(
        archaeologistFacet.depositFreeBond(BigNumber.from(-1))
      ).to.be.reverted;
    });
  });

  describe("withdrawFreeBond()", () => {
    before(beforeEachFunc);

    it("should withdraw free bond from the contract", async () => {
      // Put some free bond on the contract so we can withdraw it
      await archaeologistFacet.depositFreeBond(BigNumber.from(100));

      // Withdraw free bond
      const tx = await archaeologistFacet.withdrawFreeBond(BigNumber.from(100));
      const receipt = await tx.wait();

      // Check that the transaction succeeded
      expect(receipt.status).to.equal(1);

      const freeBond = await archaeologistFacet.getFreeBond(
        archaeologist.address
      );
      expect(freeBond.toString()).to.equal("0");

      const sarcoTokenBalance = await sarcoToken.balanceOf(
        archaeologist.address
      );
      expect(sarcoTokenBalance.toString()).to.equal(
        archaeologistSarcBalance.toString()
      );

      const contractSarcBalance = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );
      expect(contractSarcBalance.toString()).to.equal("0");
    });

    it("should emit an event when the free bond is withdrawn", async () => {
      // Put some free bond on the contract so we can withdraw it
      await archaeologistFacet.depositFreeBond(BigNumber.from(100));

      // Withdraw free bond
      const tx = await archaeologistFacet.withdrawFreeBond(BigNumber.from(100));
      const receipt = await tx.wait();
      const events = receipt.events!;
      expect(events).to.not.be.undefined;

      // Check that the list of events includes an event that has an address
      // matching the archaeologistFacet address
      expect(
        events.some((event) => event.address === archaeologistFacet.address)
      ).to.be.true;
    });

    it("should emit a transfer event when the sarco token is transfered", async () => {
      // Put some free bond on the contract so we can withdraw it
      await archaeologistFacet.depositFreeBond(BigNumber.from(100));

      // Withdraw free bond
      const tx = await archaeologistFacet.withdrawFreeBond(BigNumber.from(100));
      const receipt = await tx.wait();
      const events = receipt.events!;
      expect(events).to.not.be.undefined;

      // Check that the list of events includes an event that has an address
      // matching the archaeologistFacet address
      expect(events.some((event) => event.address === sarcoToken.address)).to.be
        .true;
    });

    it("should revert if amount is negative", async () => {
      // Try to withdraw a negative amount
      await expect(
        archaeologistFacet.withdrawFreeBond(BigNumber.from(-1))
      ).to.be.reverted;
    });

    it("should revert on attempt to withdraw more than free bond", async () => {
      // Put some free bond on the contract so we can withdraw it
      const tx = await archaeologistFacet.depositFreeBond(BigNumber.from(100));
      await tx.wait();

      // Try to withdraw with a non-archaeologist address
      await expect(
        archaeologistFacet.withdrawFreeBond(BigNumber.from(101))
      ).to.be.revertedWith("NotEnoughFreeBond");
    });
  });

  describe("unwrapSarcophagus()", () => {
    let sarcoToken: SarcoTokenMock;
    let arweaveSignature: Signature;
    let diamondAddress: string;
    let archaeologists: SignerWithAddress[];
    let signers: SignerWithAddress[];
    let embalmer: SignerWithAddress;
    let arweaveArchaeologist: SignerWithAddress;
    let recipient: SignerWithAddress;
    let embalmerFacet: EmbalmerFacet;

    const arweaveTxId = "someArweaveTxId";

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

    // Deploy the contracts
    before(async () => {
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

      arweaveSignature = await sign(
        arweaveArchaeologist,
        arweaveTxId,
        "string"
      );
    });

    const initializeSarcophagus = async (
      unhashedId: string
    ): Promise<string> => {
      const name = "New Sarcophagus";
      const identifier = ethers.utils.solidityKeccak256(
        ["string"],
        [unhashedId]
      );

      // Define archaeologist objects to be passed into the sarcophagus.
      // Since the contract doesn't care what the value of the shard is, just
      // hash the archaeologist's address. In practice we would not be hashing
      // an address, of course, but a long string representing the shard.
      const archaeologistObjects = archaeologists.map((a, i) => ({
        archAddress: a.address,
        storageFee: BigNumber.from(archaeologistsFees[i].storageFee),
        diggingFee: BigNumber.from(archaeologistsFees[i].diggingFee),
        bounty: BigNumber.from(archaeologistsFees[i].bounty),
        hashedShard: ethers.utils.solidityKeccak256(["string"], [a.address]),
      }));

      const canBeTransferred = true;

      // Set a resurrection time 1 week in the future
      const resurrectionTime =
        (await ethers.provider.getBlock("latest")).timestamp + 604800;

      const minShards = 3;

      // Create a sarcophagus as the embalmer
      await embalmerFacet
        .connect(embalmer)
        .initializeSarcophagus(
          name,
          identifier,
          archaeologistObjects,
          arweaveArchaeologist.address,
          recipient.address,
          resurrectionTime,
          canBeTransferred,
          minShards
        );

      return identifier;
    };

    const finalizeSarcophagus = async (identifier: string) => {
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

      const arweaveSignature = await sign(
        arweaveArchaeologist,
        arweaveTxId,
        "string"
      );

      // Finalize the sarcophagus
      await embalmerFacet
        .connect(embalmer)
        .finalizeSarcophagus(
          identifier,
          signatures,
          arweaveSignature,
          arweaveTxId
        );
    };

    context("Successful unwrap", () => {
      it("should store the unencrypted shard on the contract", async () => {
        // TODO: Write a view method to get the sarcophagus state
      });
      it("should free up the archaeologist's cursed bond", async () => {
        // Get the cursed bond amount of the first archaeologist before initialize
        const cursedBondAmountBefore = await archaeologistFacet.getCursedBond(
          archaeologists[0].address
        );

        // Initialize the sarcophagusk
        const identifier = await initializeSarcophagus(
          "shouldFreeUpArchsCursedBond"
        );

        // Finalize the sarcophagus
        await finalizeSarcophagus(identifier);

        // Earlier during initialize we used each archaeologist's address as the
        // unencrypted shard. In practice this will obviously not be the
        // archaeologist's address. The contract doesn't care what the
        // unencrypted shard is.
        const unencryptedShard = archaeologists[0].address;

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await increaseNextBlockTimestamp(604801);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0])
          .unwrapSarcophagus(identifier, Buffer.from(unencryptedShard));

        // Get the cursed bond amount of the first archaeologist after unwrapping
        const cursedBondAmountAfter = await archaeologistFacet.getCursedBond(
          archaeologists[0].address
        );

        // await ethers.provider.send("evm_increaseTime", [-604801]);

        // Check that the cursed bond amount before intialize and after unwrap are the same amount.
        expect(cursedBondAmountAfter).to.equal(cursedBondAmountBefore);
      });

      it("should add this sarcophagus to the archaeologist's successful sarcophaguses", async () => {
        // TODO: Write a view method to get the sarcophagus state
      });

      it("should transfer the digging fee and bounty to the archaeologist", async () => {
        // Initialize the sarcophagus
        const identifier = await initializeSarcophagus(
          "shouldTransferFeesToArch"
        );

        // Finalize the sarcophagus
        await finalizeSarcophagus(identifier);

        // Earlier during initialize we used each archaeologist's address as the
        // unencrypted shard. In practice this will obviously not be the
        // archaeologist's address. The contract doesn't care what the
        // unencrypted shard is.
        const unencryptedShard = archaeologists[0].address;

        // Calculate the digging fee and bounty for the first archaeologist
        const totalFees = BigNumber.from(
          archaeologistsFees[0].diggingFee + archaeologistsFees[0].bounty
        );
        // Get the sarco balance of the first archaeologist before unwrap
        const sarcoBalanceBefore = await sarcoToken.balanceOf(
          archaeologists[0].address
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await increaseNextBlockTimestamp(604801);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0])
          .unwrapSarcophagus(identifier, Buffer.from(unencryptedShard));

        // Get the sarco balance of the first archaeologist after unwrap
        const sarcoBalanceAfter = await sarcoToken.balanceOf(
          archaeologists[0].address
        );

        // Check that the difference between the before and after balances is
        // equal to the total fees
        expect(sarcoBalanceAfter.sub(sarcoBalanceBefore)).to.equal(totalFees);
      });

      it("should emit an event", async () => {
        // Initialize the sarcophagus
        const identifier = await initializeSarcophagus("shouldEmitAnEvent");

        // Finalize the sarcophagus
        await finalizeSarcophagus(identifier);

        // Earlier during initialize we used each archaeologist's address as the
        // unencrypted shard. In practice this will obviously not be the
        // archaeologist's address. The contract doesn't care what the
        // unencrypted shard is.
        const unencryptedShard = archaeologists[0].address;

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await increaseNextBlockTimestamp(604801);

        // Have archaeologist unwrap
        const tx = await archaeologistFacet
          .connect(archaeologists[0])
          .unwrapSarcophagus(identifier, Buffer.from(unencryptedShard));

        const receipt = await tx.wait();

        const events = receipt.events!;
        expect(events).to.not.be.undefined;

        // Check that the list of events includes an event that has an address
        // matching the embalmerFacet address
        expect(
          events.some((event) => event.address === archaeologistFacet.address)
        ).to.be.true;
      });
    });

    context("Failed unwrap", () => {
      it("should revert if the sarcophagus does not exist", async () => {
        const falseIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["falseIdentifier"]
        );

        // Earlier during initialize we used each archaeologist's address as the
        // unencrypted shard. In practice this will obviously not be the
        // archaeologist's address. The contract doesn't care what the
        // unencrypted shard is.
        const unencryptedShard = archaeologists[0].address;

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await increaseNextBlockTimestamp(604801);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0])
          .unwrapSarcophagus(falseIdentifier, Buffer.from(unencryptedShard));

        expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sender is not an archaeologist on this sarcophagus", async () => {
        // Initialize the sarcophagus
        const identifier = await initializeSarcophagus(
          "senderNotArchaeologist"
        );

        // Finalize the sarcophagus
        await finalizeSarcophagus(identifier);

        // Earlier during initialize we used each archaeologist's address as the
        // unencrypted shard. In practice this will obviously not be the
        // archaeologist's address. The contract doesn't care what the
        // unencrypted shard is.
        const unencryptedShard = archaeologists[0].address;

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await increaseNextBlockTimestamp(604801);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(embalmer)
          .unwrapSarcophagus(identifier, Buffer.from(unencryptedShard));

        expect(tx).to.be.revertedWith("SenderNotArchaeologist");
      });

      it("should revert if unwrap is called before the resurrection time has passed", async () => {
        // Initialize the sarcophagus
        const identifier = await initializeSarcophagus("calledTooEarly");

        // Finalize the sarcophagus
        await finalizeSarcophagus(identifier);

        // Earlier during initialize we used each archaeologist's address as the
        // unencrypted shard. In practice this will obviously not be the
        // archaeologist's address. The contract doesn't care what the
        // unencrypted shard is.
        const unencryptedShard = archaeologists[0].address;

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0])
          .unwrapSarcophagus(identifier, Buffer.from(unencryptedShard));

        expect(tx).to.be.revertedWith("TooEarlyToUnwrap");
      });

      it("should revert if unwrap is called after the resurrection window has expired", async () => {
        // Initialize the sarcophagus
        const identifier = await initializeSarcophagus("calledTooLate");

        // Finalize the sarcophagus
        await finalizeSarcophagus(identifier);

        // Earlier during initialize we used each archaeologist's address as the
        // unencrypted shard. In practice this will obviously not be the
        // archaeologist's address. The contract doesn't care what the
        // unencrypted shard is.
        const unencryptedShard = archaeologists[0].address;

        // Set the evm timestamp of the next block to be 2 weeks in the future
        await increaseNextBlockTimestamp(604800 * 2);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0])
          .unwrapSarcophagus(identifier, Buffer.from(unencryptedShard));

        expect(tx).to.be.revertedWith("TooLateToUnwrap");
      });

      it("should revert if this archaeologist has already unwrapped this sarcophagus", async () => {
        // Initialize the sarcophagus
        const identifier = await initializeSarcophagus("archAlreadyUnwrapped");

        // Finalize the sarcophagus
        await finalizeSarcophagus(identifier);

        // Earlier during initialize we used each archaeologist's address as the
        // unencrypted shard. In practice this will obviously not be the
        // archaeologist's address. The contract doesn't care what the
        // unencrypted shard is.
        const unencryptedShard = archaeologists[0].address;

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await increaseNextBlockTimestamp(604801);

        await archaeologistFacet
          .connect(archaeologists[0])
          .unwrapSarcophagus(identifier, Buffer.from(unencryptedShard));

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0])
          .unwrapSarcophagus(identifier, Buffer.from(unencryptedShard));

        expect(tx).to.be.revertedWith("ArchaeologistAlreadyUnwrapped");
      });

      it("should revert if the hash of the unencrypted shard does not match the hashed shard stored on the sarcophagus", async () => {
        // Initialize the sarcophagus
        const identifier = await initializeSarcophagus("shardMismatch");

        // Finalize the sarcophagus
        await finalizeSarcophagus(identifier);

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await increaseNextBlockTimestamp(604801);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0])
          .unwrapSarcophagus(identifier, Buffer.from("somethingElse"));

        expect(tx).to.be.revertedWith("UnencryptedShardHashMismatch");
      });

      it("should revert if the sarcophagus is not finalized", async () => {
        // Initialize the sarcophagus
        const identifier = await initializeSarcophagus("sarcNotFinalized");

        // Earlier during initialize we used each archaeologist's address as the
        // unencrypted shard. In practice this will obviously not be the
        // archaeologist's address. The contract doesn't care what the
        // unencrypted shard is.
        const unencryptedShard = archaeologists[0].address;

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await increaseNextBlockTimestamp(604801);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0])
          .unwrapSarcophagus(identifier, Buffer.from(unencryptedShard));

        expect(tx).to.be.revertedWith("SarcophagusNotFinalized");
      });
    });
  });
});
