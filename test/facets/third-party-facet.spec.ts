import "@nomiclabs/hardhat-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";
import { ethers, deployments } from "hardhat";
import {
  ThirdPartyFacet,
  SarcoTokenMock,
  ArchaeologistFacet,
  EmbalmerFacet,
  ViewStateFacet,
} from "../../typechain";
import { BytesLike, formatBytes32String } from "ethers/lib/utils";
import time from "../utils/time";
import { calculateCursedBond, sign } from "../utils/helpers";

describe("Contract: ThirdPartyFacet", () => {
  let archaeologistFacet: ArchaeologistFacet;
  let embalmerFacet: EmbalmerFacet;
  let viewStateFacet: ViewStateFacet;
  let thirdPartyFacet: ThirdPartyFacet;

  let archaeologist1: SignerWithAddress;
  let archaeologist2: SignerWithAddress;
  let arweaveAchaeologist: SignerWithAddress;
  let unaccusedArchaeologist: SignerWithAddress;
  let embalmer: SignerWithAddress;
  let receiverAddress: SignerWithAddress;
  let thirdParty: SignerWithAddress;
  let paymentAccount: SignerWithAddress;

  let sarcoToken: SarcoTokenMock;
  let diamondAddress: string;
  let resurrectionTime: BigNumberish;

  let sarcoId: BytesLike;

  const freeBond = BigNumber.from(100);
  const storageFee = BigNumber.from(1);
  const diggingFee = BigNumber.from(1);
  const bounty = BigNumber.from(1);
  const balance = BigNumber.from(100000);

  const sarcoResurrectionTimeInDays = 1;

  const unencryptedShards: string[] = [
    formatBytes32String("unencryptedShard1"),
    formatBytes32String("unencryptedShard2"),
    formatBytes32String("unencryptedShard3"),
    formatBytes32String("unencryptedShard4"),
  ];

  let hashedShards: string[];

  const _distributeTokens = async () => {
    sarcoToken.transfer(archaeologist1.address, balance.add(648));
    sarcoToken.transfer(archaeologist2.address, balance.add(34));
    sarcoToken.transfer(arweaveAchaeologist.address, balance.add(768));
    sarcoToken.transfer(unaccusedArchaeologist.address, balance.add(798));
    sarcoToken.transfer(embalmer.address, balance.add(23));
  };

  const _approveSpending = async () => {
    await sarcoToken
      .connect(thirdParty)
      .approve(diamondAddress, ethers.constants.MaxUint256);
    await sarcoToken
      .connect(embalmer)
      .approve(diamondAddress, ethers.constants.MaxUint256);
    await sarcoToken
      .connect(archaeologist1)
      .approve(diamondAddress, ethers.constants.MaxUint256);
    await sarcoToken
      .connect(archaeologist2)
      .approve(diamondAddress, ethers.constants.MaxUint256);
    await sarcoToken
      .connect(arweaveAchaeologist)
      .approve(diamondAddress, ethers.constants.MaxUint256);
    await sarcoToken
      .connect(unaccusedArchaeologist)
      .approve(diamondAddress, ethers.constants.MaxUint256);
  };

  const _setupArcheologists = async () => {
    archaeologistFacet = await ethers.getContractAt(
      "ArchaeologistFacet",
      diamondAddress
    );

    await archaeologistFacet
      .connect(archaeologist1)
      .depositFreeBond(freeBond.add(486));
    await archaeologistFacet
      .connect(archaeologist2)
      .depositFreeBond(freeBond.add(978));
    await archaeologistFacet
      .connect(arweaveAchaeologist)
      .depositFreeBond(freeBond.add(2332));
    await archaeologistFacet
      .connect(unaccusedArchaeologist)
      .depositFreeBond(freeBond.add(859));
  };

  const _setupTestSarcophagus = async () => {
    embalmerFacet = await ethers.getContractAt("EmbalmerFacet", diamondAddress);

    sarcoId = formatBytes32String("sarcoId");

    hashedShards = [];

    unencryptedShards.forEach((shard) => {
      hashedShards.push(ethers.utils.solidityKeccak256(["bytes32"], [shard]));
    });

    const archs = [
      {
        archAddress: archaeologist1.address,
        storageFee,
        diggingFee,
        bounty,
        hashedShard: hashedShards[0],
      },
      {
        archAddress: archaeologist2.address,
        storageFee,
        diggingFee,
        bounty,
        hashedShard: hashedShards[1],
      },
      {
        archAddress: arweaveAchaeologist.address,
        storageFee,
        diggingFee,
        bounty,
        hashedShard: hashedShards[2],
      },
      {
        archAddress: unaccusedArchaeologist.address,
        storageFee,
        diggingFee,
        bounty,
        hashedShard: hashedShards[3],
      },
    ];

    const tomorrow =
      (await time.latest()) + time.duration.days(sarcoResurrectionTimeInDays);

    resurrectionTime = BigNumber.from(tomorrow);

    const arweavetxId = "arweavetxId";
    const initSarcoTx = await embalmerFacet
      .connect(embalmer)
      .initializeSarcophagus(
        "Test Sarco",
        sarcoId,
        archs,
        arweaveAchaeologist.address,
        receiverAddress.address,
        resurrectionTime,
        false,
        2
      );

    await initSarcoTx.wait();

    const signature1 = await sign(archaeologist1, sarcoId, "bytes32");
    const signature2 = await sign(archaeologist2, sarcoId, "bytes32");
    const signature3 = await sign(unaccusedArchaeologist, sarcoId, "bytes32");
    const arweaveArchSig = await sign(
      arweaveAchaeologist,
      arweavetxId,
      "string"
    );

    await embalmerFacet.connect(embalmer).finalizeSarcophagus(
      sarcoId,
      [
        { account: archaeologist1.address, ...signature1 },
        { account: archaeologist2.address, ...signature2 },
        { account: unaccusedArchaeologist.address, ...signature3 },
      ],
      arweaveArchSig,
      arweavetxId
    );
  };

  const _initialiseEnvironment = async () => {
    const signers = await ethers.getSigners();

    thirdParty = signers[0];
    embalmer = signers[1];
    paymentAccount = signers[2];
    archaeologist1 = signers[3];
    archaeologist2 = signers[4];
    arweaveAchaeologist = signers[5];
    receiverAddress = signers[6];
    unaccusedArchaeologist = signers[7];

    await deployments.fixture();
    sarcoToken = await ethers.getContract("SarcoTokenMock");
    diamondAddress = (await ethers.getContract("Diamond_DiamondProxy")).address;

    await _distributeTokens();

    // Approve signers on the sarco token so transferFrom will work
    await _approveSpending();

    thirdPartyFacet = await ethers.getContractAt(
      "ThirdPartyFacet",
      diamondAddress
    );

    viewStateFacet = await ethers.getContractAt(
      "ViewStateFacet",
      diamondAddress
    );

    // Setup archaeologists - add free bonds to their accounts
    await _setupArcheologists();

    // Create a sarcophagus with archaeologists assigned, with a 1 day resurrection time
    await _setupTestSarcophagus();
  };

  describe("clean()", () => {
    beforeEach(_initialiseEnvironment);

    context("When successful", () => {
      it("Should distribute sum of cursed bonds of bad-acting archaeologists to embalmer and the address specified by cleaner", async () => {
        // Increase time to when sarco can be unwrapped
        await time.increase(time.duration.days(sarcoResurrectionTimeInDays));

        // unaccusedArchaeologist will fulfil their duty
        archaeologistFacet.connect(unaccusedArchaeologist).unwrapSarcophagus(sarcoId, unencryptedShards[3])

        // Increasing by this much so that the sarco is definitely expired
        await time.increase(time.duration.years(sarcoResurrectionTimeInDays));

        let embalmerBalanceBefore = await sarcoToken.balanceOf(embalmer.address);
        let paymentAccountBalanceBefore = await sarcoToken.balanceOf(
          paymentAccount.address
        );

        // before cleaning...
        expect(paymentAccountBalanceBefore).to.eq(0);

        const tx = await thirdPartyFacet
          .connect(thirdParty)
          .clean(sarcoId, paymentAccount.address);
        const receipt = await tx.wait();

        expect(receipt.status).to.equal(1);

        let embalmerBalanceAfter = await sarcoToken.balanceOf(embalmer.address);
        let paymentAccountBalanceAfter = await sarcoToken.balanceOf(
          paymentAccount.address
        );

        // after cleaning, calculate sum, and verify on exact amounts instead
        // Set up amounts that should have been transferred to accuser and embalmer
        const arch1 = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          archaeologist1.address
        );
        const arch2 = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          archaeologist2.address
        );
        const arch3 = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          arweaveAchaeologist.address
        );

        const totalDiggingFees = arch1.diggingFee
          .add(arch2.diggingFee)
          .add(arch3.diggingFee);

        const totalBounty = arch1.bounty
          .add(arch2.bounty)
          .add(arch3.bounty);

        const cursedBond = calculateCursedBond(totalDiggingFees, totalBounty);
        const toEmbalmer = cursedBond.div(2);
        const toCleaner = cursedBond.sub(toEmbalmer);

        // Check that embalmer and accuser now has balance that includes the amount that should have been transferred to them
        const embalmerReward = toEmbalmer.add(totalBounty.add(totalDiggingFees)); // embalmer should receive half cursed bond, PLUS bounty and digging fees of failed archs
        expect(embalmerBalanceAfter.eq(embalmerBalanceBefore.add(embalmerReward)))
          .to.be.true;
        expect(
          paymentAccountBalanceAfter.eq(
            paymentAccountBalanceBefore.add(toCleaner)
          )
        ).to.be.true;
      });

      it("Should reduce cursed bonds on storage of archaeologists after distributing their value, without increasing free bond of bad-acting ones", async () => {
        // Cursed bonds before cleaning:
        const cursedBond1Before = await viewStateFacet.getCursedBond(archaeologist1.address);
        const cursedBond2Before = await viewStateFacet.getCursedBond(archaeologist2.address);
        const cursedBond3Before = await viewStateFacet.getCursedBond(arweaveAchaeologist.address);
        const cursedBondGoodBefore = await viewStateFacet.getCursedBond(unaccusedArchaeologist.address);

        const freeBond1Before = await viewStateFacet.getFreeBond(archaeologist1.address);
        const freeBond2Before = await viewStateFacet.getFreeBond(archaeologist2.address);
        const freeBond3Before = await viewStateFacet.getFreeBond(arweaveAchaeologist.address);
        const freeBondGoodBefore = await viewStateFacet.getFreeBond(unaccusedArchaeologist.address);

        // Increase time to when sarco can be unwrapped
        await time.increase(time.duration.days(sarcoResurrectionTimeInDays));

        // Have one arch actually do the unwrapping
        const unwrapTx = await archaeologistFacet.connect(unaccusedArchaeologist).unwrapSarcophagus(sarcoId, unencryptedShards[3]);
        await unwrapTx.wait();

        // Increasing by this much so that the sarco is definitely expired
        await time.increase(time.duration.years(sarcoResurrectionTimeInDays));

        const tx = await thirdPartyFacet.connect(thirdParty).clean(sarcoId, paymentAccount.address);
        await tx.wait();

        // Cursed bonds after cleaning:
        const cursedBond1After = await viewStateFacet.getCursedBond(archaeologist1.address);
        const cursedBond2After = await viewStateFacet.getCursedBond(archaeologist2.address);
        const cursedBond3After = await viewStateFacet.getCursedBond(arweaveAchaeologist.address);
        const cursedBondGoodAfter = await viewStateFacet.getCursedBond(unaccusedArchaeologist.address);

        const freeBond1After = await viewStateFacet.getFreeBond(archaeologist1.address);
        const freeBond2After = await viewStateFacet.getFreeBond(archaeologist2.address);
        const freeBond3After = await viewStateFacet.getFreeBond(arweaveAchaeologist.address);
        const freeBondGoodAfter = await viewStateFacet.getFreeBond(unaccusedArchaeologist.address);

        // Check that all archaeologists' cursed bonds have been reduced
        expect(cursedBond1Before.gt(cursedBond1After)).to.be.true;
        expect(cursedBond2Before.gt(cursedBond2After)).to.be.true;
        expect(cursedBond3Before.gt(cursedBond3After)).to.be.true;
        expect(cursedBondGoodBefore.gt(cursedBondGoodAfter)).to.be.true;

        // Check that accused archaeologists' free bonds have NOT been increased
        expect(freeBond1Before.eq(freeBond1After)).to.be.true;
        expect(freeBond2Before.eq(freeBond2After)).to.be.true;
        expect(freeBond3Before.eq(freeBond3After)).to.be.true;

        // Check that good archaeologist's free bonds have been increased
        expect(freeBondGoodBefore.lt(freeBondGoodAfter)).to.be.true;
      });

      it("Should emit CleanUpSarcophagus on successful cleanup", async () => {
        // Increasing by this much so that the sarco is definitely expired
        await time.increase(time.duration.years(sarcoResurrectionTimeInDays));

        const tx = thirdPartyFacet
          .connect(thirdParty)
          .clean(sarcoId, paymentAccount.address);

        await expect(tx).to.emit(thirdPartyFacet, "CleanUpSarcophagus");
      });

      it("Should add all defaulting archaeologists to archaeologistCleanups storage on successful cleanup", async () => {
        // Have one arch actually do the unwrapping
        await time.increase(time.duration.days(sarcoResurrectionTimeInDays));
        await archaeologistFacet.connect(unaccusedArchaeologist).unwrapSarcophagus(sarcoId, unencryptedShards[3]);

        // Increasing by this much so that the sarco is definitely expired
        await time.increase(time.duration.years(sarcoResurrectionTimeInDays));

        const tx = await thirdPartyFacet.connect(thirdParty).clean(sarcoId, paymentAccount.address);
        await tx.wait();

        const arch1Cleanups = await viewStateFacet.getArchaeologistCleanups(archaeologist1.address);
        const arch2Cleanups = await viewStateFacet.getArchaeologistCleanups(archaeologist2.address);
        const arch3Cleanups = await viewStateFacet.getArchaeologistCleanups(arweaveAchaeologist.address);
        const goodArchCleanups = await viewStateFacet.getArchaeologistCleanups(unaccusedArchaeologist.address);

        expect(arch1Cleanups).contains(sarcoId);
        expect(arch2Cleanups).contains(sarcoId);
        expect(arch3Cleanups).contains(sarcoId);
        expect(goodArchCleanups).not.contains(sarcoId);
      });
    });

    context("Reverts", () => {
      it("Should revert if cleaning is attempted before sacro can be unwrapped, or attempted within its resurrection grace period", async () => {
        // No time advancement before clean attempt
        const cleanTx = thirdPartyFacet
          .connect(thirdParty)
          .clean(sarcoId, paymentAccount.address);
        await expect(cleanTx).to.be.revertedWith("SarcophagusNotCleanable()");

        // Increasing time up to just around the sarco's resurrection time means it will still be within grace window
        await time.increase(time.duration.days(sarcoResurrectionTimeInDays));

        const cleanTxAgain = thirdPartyFacet
          .connect(thirdParty)
          .clean(sarcoId, paymentAccount.address);
        await expect(cleanTxAgain).to.be.revertedWith(
          "SarcophagusNotCleanable()"
        );
      });

      it("Should revert with SarcophagusDoesNotExist if sarco identifier is unknown", async () => {
        const tx = thirdPartyFacet
          .connect(thirdParty)
          .clean(formatBytes32String("unknown-sarcoId"), paymentAccount.address);
        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("Should revert with SarcophagusDoesNotExist if cleaning an already cleaned sarcophagus", async () => {
        // Increasing time up to so sarco is cleanable
        await time.increase(time.duration.years(sarcoResurrectionTimeInDays));

        (
          await thirdPartyFacet
            .connect(thirdParty)
            .clean(sarcoId, paymentAccount.address)
        ).wait();

        const tx = thirdPartyFacet
          .connect(thirdParty)
          .clean(sarcoId, paymentAccount.address);
        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });
    });
  });

  describe("accuse()", () => {
    beforeEach(_initialiseEnvironment);

    context("when m unencrypted shard are provided", async () => {
      it("Should emit AccuseArchaeologist", async () => {
        const tx = thirdPartyFacet
          .connect(thirdParty)
          .accuse(
            sarcoId,
            unencryptedShards.slice(0, 2),
            paymentAccount.address
          );
        await expect(tx).to.emit(thirdPartyFacet, "AccuseArchaeologist");
      });

      it("Should update sarcophagus' state to DONE", async () => {
        let sarco = await viewStateFacet.getSarcophagus(sarcoId);
        expect(sarco.state).to.be.eq(1); // 1 is "Exists"

        const tx = await thirdPartyFacet
          .connect(thirdParty)
          .accuse(
            sarcoId,
            unencryptedShards.slice(0, 2),
            paymentAccount.address
          );
        await tx.wait();

        sarco = await viewStateFacet.getSarcophagus(sarcoId);
        expect(sarco.state).to.be.eq(2); // 2 is "Done"
      });

      it("Should distribute half the sum of the accused archaeologists' bounties and digging fees to accuser, and other half to embalmer", async () => {
        const embalmerBalanceBefore = await sarcoToken.balanceOf(
          embalmer.address
        );
        const paymentAccountBalanceBefore = await sarcoToken.balanceOf(
          paymentAccount.address
        );

        expect(paymentAccountBalanceBefore.eq(0)).to.be.true;

        const tx = await thirdPartyFacet
          .connect(thirdParty)
          .accuse(
            sarcoId,
            unencryptedShards.slice(0, 2),
            paymentAccount.address
          );
        await tx.wait();

        // Set up amounts that should have been transferred to accuser and embalmer
        const arch1 = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          archaeologist1.address
        );
        const arch2 = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          archaeologist2.address
        );

        const totalDiggingFees = arch1.diggingFee.add(arch2.diggingFee);
        const totalBounty = arch1.bounty.add(arch2.bounty);

        const cursedBond = calculateCursedBond(totalDiggingFees, totalBounty);
        const toEmbalmer = cursedBond.div(2);
        const toAccuser = cursedBond.sub(toEmbalmer);

        const embalmerBalanceAfter = await sarcoToken.balanceOf(
          embalmer.address
        );
        const paymentAccountBalanceAfter = await sarcoToken.balanceOf(
          paymentAccount.address
        );

        // Check that embalmer and accuser now has balance that includes the amount that should have been transferred to them
        const embalmerReward = toEmbalmer.add(
          totalBounty.add(totalDiggingFees)
        ); // embalmer should receive half cursed bond, PLUS bounty and digging fees of failed archs
        expect(
          embalmerBalanceAfter.eq(embalmerBalanceBefore.add(embalmerReward))
        ).to.be.true;
        expect(
          paymentAccountBalanceAfter.eq(
            paymentAccountBalanceBefore.add(toAccuser)
          )
        ).to.be.true;
      });

      it("Should reduce cursed bond on storage of accused archaeologists after distributing their value, without increasing their free bond", async () => {
        const cursedBond1Before = await viewStateFacet.getCursedBond(archaeologist1.address);
        const cursedBond2Before = await viewStateFacet.getCursedBond(archaeologist2.address);
        const freeBond1Before = await viewStateFacet.getFreeBond(archaeologist1.address);
        const freeBond2Before = await viewStateFacet.getFreeBond(archaeologist2.address);

        const tx = await thirdPartyFacet.connect(thirdParty).accuse(sarcoId, unencryptedShards.slice(0, 2), paymentAccount.address);
        await tx.wait();

        const cursedBond1After = await viewStateFacet.getCursedBond(archaeologist1.address);
        const cursedBond2After = await viewStateFacet.getCursedBond(archaeologist2.address);
        const freeBond1After = await viewStateFacet.getFreeBond(archaeologist1.address);
        const freeBond2After = await viewStateFacet.getFreeBond(archaeologist2.address);

        // Check that accused archaeologists' cursed bonds have been reduced
        expect(cursedBond1Before.gt(cursedBond1After)).to.be.true;
        expect(cursedBond2Before.gt(cursedBond2After)).to.be.true;

        // Check that accused archaeologists' free bonds have NOT been increased
        expect(freeBond1Before.eq(freeBond1After)).to.be.true;
        expect(freeBond2Before.eq(freeBond2After)).to.be.true;
      });

      it("Should un-curse the bond (on storage) of unaccused archaeologists", async () => {
        const cursedBond1Before = await viewStateFacet.getCursedBond(arweaveAchaeologist.address);
        const cursedBond2Before = await viewStateFacet.getCursedBond(unaccusedArchaeologist.address);
        const freeBond1Before = await viewStateFacet.getFreeBond(arweaveAchaeologist.address);
        const freeBond2Before = await viewStateFacet.getFreeBond(unaccusedArchaeologist.address);

        const tx = await thirdPartyFacet.connect(thirdParty).accuse(sarcoId, unencryptedShards.slice(0, 2), paymentAccount.address);
        await tx.wait();

        const cursedBond1After = await viewStateFacet.getCursedBond(archaeologist1.address);
        const cursedBond2After = await viewStateFacet.getCursedBond(archaeologist2.address);
        const freeBond1After = await viewStateFacet.getFreeBond(arweaveAchaeologist.address);
        const freeBond2After = await viewStateFacet.getFreeBond(unaccusedArchaeologist.address);

        // Check that unaccused archaeologists' cursed bonds have been un-cursed
        expect(cursedBond1Before.gt(cursedBond1After)).to.be.true;
        expect(cursedBond2Before.gt(cursedBond2After)).to.be.true;

        // Check that unaccused archaeologists' free bonds have been increased
        expect(freeBond1Before.lt(freeBond1After)).to.be.true;
        expect(freeBond2Before.lt(freeBond2After)).to.be.true;
      });

      it("Should not actually transfer tokens (being explicit here, cz of recent refactoring)", async () => {
        const unaccusedArchaeologist1BalBefore = await sarcoToken.balanceOf(arweaveAchaeologist.address);
        const unaccusedArchaeologist2BalBefore = await sarcoToken.balanceOf(unaccusedArchaeologist.address);

        const tx = await thirdPartyFacet.connect(thirdParty).accuse(sarcoId, unencryptedShards.slice(0, 2), paymentAccount.address);
        await tx.wait();

        const unaccusedArchaeologist1BalAfter = await sarcoToken.balanceOf(arweaveAchaeologist.address);
        const unaccusedArchaeologist2BalAfter = await sarcoToken.balanceOf(unaccusedArchaeologist.address);

        // Check that unaccused archaeologists balances are unaffected
        expect(unaccusedArchaeologist1BalAfter.eq(unaccusedArchaeologist1BalBefore)).to.be.true;
        expect(unaccusedArchaeologist2BalAfter.eq(unaccusedArchaeologist2BalBefore)).to.be.true;
      });

      it("Should add all accused archaeologists to archaeologistAccusals storage on successful accusal", async () => {
        const tx = await thirdPartyFacet.connect(thirdParty).accuse(sarcoId, unencryptedShards.slice(0, 2), paymentAccount.address);
        await tx.wait();

        const arch1Accusals = await viewStateFacet.getArchaeologistAccusals(archaeologist1.address);
        const arch2Accusals = await viewStateFacet.getArchaeologistAccusals(archaeologist2.address);
        const arch3Accusals = await viewStateFacet.getArchaeologistAccusals(arweaveAchaeologist.address);
        const goodArchAccusals = await viewStateFacet.getArchaeologistAccusals(unaccusedArchaeologist.address);

        expect(arch1Accusals).contains(sarcoId);
        expect(arch2Accusals).contains(sarcoId);
        expect(arch3Accusals).not.contains(sarcoId);
        expect(goodArchAccusals).not.contains(sarcoId);
      });
    });

    context("Reverts", () => {
      it("Should revert with SarcophagusIsUnwrappable() if called after resurrection time has passed", async () => {
        // Increasing time up to just around the sarco's resurrection time means it will still be within grace window
        await time.increase(time.duration.days(sarcoResurrectionTimeInDays));

        const tx = thirdPartyFacet
          .connect(thirdParty)
          .accuse(sarcoId, unencryptedShards.slice(0, 2), paymentAccount.address);
        await expect(tx).to.be.revertedWith("SarcophagusIsUnwrappable()");
      });

      it("Should revert with NotEnoughProof() if less than m unencrypted shards are provided", async () => {
        const tx = thirdPartyFacet
          .connect(thirdParty)
          .accuse(sarcoId, [], paymentAccount.address);
        await expect(tx).to.be.revertedWith("NotEnoughProof()");

        const tx2 = thirdPartyFacet
          .connect(thirdParty)
          .accuse(sarcoId, [unencryptedShards[0]], paymentAccount.address);
        await expect(tx2).to.be.revertedWith("NotEnoughProof()");
      });

      it("Should revert with NotEnoughProof() if at least m unencrypted shards are provided, but one or more are invalid", async () => {
        const tx2 = thirdPartyFacet
          .connect(thirdParty)
          .accuse(
            sarcoId,
            [unencryptedShards[0], hashedShards[1]],
            paymentAccount.address
          );
        await expect(tx2).to.be.revertedWith("NotEnoughProof()");
      });

      it("Should revert with SarcophagusDoesNotExist if sarco identifier is unknown", async () => {
        const tx = thirdPartyFacet
          .connect(thirdParty)
          .accuse(
            formatBytes32String("unknown-id"),
            unencryptedShards.slice(0, 2),
            paymentAccount.address
          );
        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("Should revert with SarcophagusDoesNotExist if calling accuse on a previously accused sarcophagus", async () => {
        (
          await thirdPartyFacet
            .connect(thirdParty)
            .accuse(
              sarcoId,
              unencryptedShards.slice(0, 2),
              paymentAccount.address
            )
        ).wait();

        const tx = thirdPartyFacet
          .connect(thirdParty)
          .accuse(sarcoId, unencryptedShards.slice(0, 2), paymentAccount.address);
        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });
    });
  });
});
