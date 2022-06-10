import "@nomiclabs/hardhat-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployDiamond } from "../../scripts/deploy-diamond";
import { ArchaeologistFacet, SarcoTokenMock } from "../../typechain";
import { BigNumber, ContractTransaction } from "ethers";
import { EmbalmerFacet } from "../../typechain/EmbalmerFacet";

describe("Contract: EmbalmerFacet", () => {
  const firstArchaeologistBounty = 100;
  const firstArchaeologistDiggingFee = 10;

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

  // Set up some variables to be used in the tests
  let embalmerFacet: EmbalmerFacet;
  let archaeologistFacet: ArchaeologistFacet;
  let embalmer: SignerWithAddress;
  let archaeologists: SignerWithAddress[];
  let recipient: SignerWithAddress;
  let arweaveArchaeologist: SignerWithAddress;
  let sarcoToken: SarcoTokenMock;

  // Deploys the entire diamond before each test.
  // This is necessary so that each test will start in a clean state.
  beforeEach(async () => {
    // Deploy the sarco token contract
    const SarcoToken = await ethers.getContractFactory("SarcoTokenMock");
    sarcoToken = await SarcoToken.deploy();
    await sarcoToken.deployed();

    const signers = await ethers.getSigners();

    // Set some roles to be used in the tests
    embalmer = signers[0];
    archaeologists = [signers[1], signers[2], signers[3]];
    arweaveArchaeologist = signers[1];
    recipient = signers[4];

    const diamondAddress = await deployDiamond();
    embalmerFacet = await ethers.getContractAt("EmbalmerFacet", diamondAddress);

    // Get the archaeologistFacet so we can add some free bond for the archaeologists
    archaeologistFacet = await ethers.getContractAt(
      "ArchaeologistFacet",
      diamondAddress
    );

    for (const archaeologist of archaeologists) {
      // Transfer 10,000 sarco tokens to each archaeologist to be put into free
      // bond
      await sarcoToken.transfer(archaeologist.address, BigNumber.from(10_000));

      // Approve the archaeologist on the sarco token so transferFrom will work
      await sarcoToken
        .connect(archaeologist)
        .approve(diamondAddress, ethers.constants.MaxUint256);

      // Approve the embalmer on the sarco token so transferFrom will work
      await sarcoToken
        .connect(embalmer)
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
  });

  describe("initializeSarcophagus()", () => {
    /**
     * Creates a sarcophagus with random data.
     * This is used in several places throughout the tests.
     */
    const initializeSarcophagus = async (
      name: string,
      resurrectionTime?: BigNumber
    ): Promise<ContractTransaction> => {
      // Define archaeologist objects to be passed into the sarcophagus
      const archaeologistObjects = archaeologists.map((a, i) => ({
        archAddress: a.address,
        storageFee: BigNumber.from(archaeologistsFees[i].storageFee),
        diggingFee: BigNumber.from(archaeologistsFees[i].diggingFee),
        bounty: BigNumber.from(archaeologistsFees[i].bounty),
        hashedShard: ethers.utils.solidityKeccak256(["string"], [a.address]),
      }));

      // Set resurrection time to 1 week from now in seconds as a big number.
      // Date is an integer representing the number of seconds since the epoch.
      // Deafult to argument in function.
      const _resurrectionTime =
        resurrectionTime ||
        BigNumber.from((Date.now() / 1000 + 60 * 60 * 24 * 7).toFixed(0));

      // Generate a hash from the name to use as the identifier. It doesn't
      // matter what the hash is of for the tests.
      const identifier = ethers.utils.solidityKeccak256(["string"], [name]);

      const canBeTransfered = true;

      // Create a sarcophagus as the embalmer
      const tx = await embalmerFacet
        .connect(embalmer)
        .initializeSarcophagus(
          name,
          archaeologistObjects,
          arweaveArchaeologist.address,
          recipient.address,
          _resurrectionTime,
          identifier,
          sarcoToken.address,
          canBeTransfered
        );

      return tx;
    };

    it("should successfully create sarcophagus", async () => {
      const tx = await initializeSarcophagus("Test Sarcophagus");
      const receipt = await tx.wait();

      expect(receipt.status).to.equal(1);
    });

    it("should revert when creating a sarcophagus that already exists", async () => {
      await initializeSarcophagus("Test Sarcophagus");

      // Try to create the same sarcophagus again
      await expect(
        initializeSarcophagus("Test Sarcophagus")
      ).to.be.revertedWith("SarcophagusAlreadyExists");
    });

    it("should revert if the resurrection time is not in the future", () => {
      return expect(
        initializeSarcophagus(
          "Test Sarcophagus",
          BigNumber.from((Date.now() / 1000).toFixed(0))
        )
      ).to.be.revertedWith("ResurrectionTimeInPast");
    });

    it("should revert if no archaeologists are provided", async () => {
      // Not using the initalizeSarcophagus function provided in this spec so we
      // can send an empty array for archaeologists
      const name = "Sarcohpagus Test";

      // Set resurrection time to 1 week from now in seconds as a big number.
      // Date is an integer representing the number of seconds since the epoch.
      // Deafult to argument in function.
      const _resurrectionTime = BigNumber.from(
        (Date.now() / 1000 + 60 * 60 * 24 * 7).toFixed(0)
      );

      // Generate a hash from the name to use as the identifier. It doesn't
      // matter what the hash is of for the tests.
      const identifier = ethers.utils.solidityKeccak256(["string"], [name]);

      const canBeTransfered = true;

      // Create a sarcophagus as the embalmer
      const tx = embalmerFacet
        .connect(embalmer)
        .initializeSarcophagus(
          name,
          identifier,
          [],
          arweaveArchaeologist.address,
          recipient.address,
          _resurrectionTime,
          sarcoToken.address,
          canBeTransfered
        );

      return expect(tx).to.be.revertedWith("no archaeologists provided");
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
        initializeSarcophagus("Test Sarcophagus")
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

      await initializeSarcophagus("Test Sarcophagus");

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

      await initializeSarcophagus("Test Sarcophagus");

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
      const tx = await initializeSarcophagus("Test Sarcophagus");
      const receipt = await tx.wait();

      const events = receipt.events!;
      expect(events).to.not.be.undefined;

      // Check that the list of events includes an event that has an address
      // matching the embalmerFacet address
      expect(events.some((event) => event.address === embalmerFacet.address)).to
        .be.true;
    });
  });
});
