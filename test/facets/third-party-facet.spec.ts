import "@nomiclabs/hardhat-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";
import { ethers } from "hardhat";
import { deployDiamond } from "../../scripts/deploy-diamond";
import { ThirdPartyFacet, SarcoTokenMock, ArchaeologistFacet, EmbalmerFacet } from "../../typechain";
import { BytesLike, formatBytes32String } from "ethers/lib/utils";
import time from "../utils/time";
import { sign } from "../utils/helpers";

describe("Contract: ThirdPartyFacet", () => {
    let archaeologistFacet: ArchaeologistFacet;
    let embalmerFacet: EmbalmerFacet;
    let thirdPartyFacet: ThirdPartyFacet;

    let archaeologist1: SignerWithAddress;
    let archaeologist2: SignerWithAddress;
    let arweaveAchaeologist: SignerWithAddress;
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
    const balance = BigNumber.from(1000);

    const sarcoResurrectionTimeInDays = 1;

    const unencryptedShards: string[] = [
        formatBytes32String("unencryptedShard1"),
        formatBytes32String("unencryptedShard2"),
        formatBytes32String("unencryptedShard3"),
    ];

    let hashedShards: string[];

    const _distributeTokens = async () => {
        sarcoToken.transfer(archaeologist1.address, balance);
        sarcoToken.transfer(archaeologist2.address, balance);
        sarcoToken.transfer(arweaveAchaeologist.address, balance);
        sarcoToken.transfer(embalmer.address, balance);
    }

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
    }

    const _setupArcheologists = async () => {
        archaeologistFacet = await ethers.getContractAt("ArchaeologistFacet", diamondAddress);

        archaeologistFacet.connect(archaeologist1).depositFreeBond(freeBond)
        archaeologistFacet.connect(archaeologist2).depositFreeBond(freeBond)
        archaeologistFacet.connect(arweaveAchaeologist).depositFreeBond(freeBond)
    }

    const _setupTestSarcophagus = async () => {
        embalmerFacet = await ethers.getContractAt("EmbalmerFacet", diamondAddress);

        sarcoId = formatBytes32String("sarcoId");

        hashedShards = [];
        for (let i = 0; i < 3; i++) {
            hashedShards.push(ethers.utils.solidityKeccak256(
                ['bytes32'],
                [unencryptedShards[i]]
            ))
        }

        const archs = [
            { archAddress: archaeologist1.address, storageFee, diggingFee, bounty, hashedShard: hashedShards[0] },
            { archAddress: archaeologist2.address, storageFee, diggingFee, bounty, hashedShard: hashedShards[1] },
            { archAddress: arweaveAchaeologist.address, storageFee, diggingFee, bounty, hashedShard: hashedShards[2] },
        ];

        const tomorrow = (await time.latest()) + time.duration.days(sarcoResurrectionTimeInDays);

        resurrectionTime = BigNumber.from(tomorrow);

        const arweavetxId = "arweavetxId";
        const initSarcoTx = await embalmerFacet.connect(embalmer)
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
        const arweaveArchSig = await sign(arweaveAchaeologist, arweavetxId, "string");


        await embalmerFacet.connect(embalmer).finalizeSarcophagus(
            sarcoId,
            [
                { account: archaeologist1.address, ...signature1 },
                { account: archaeologist2.address, ...signature2 },
            ],
            arweaveArchSig,
            arweavetxId,
        );
    }

    const _initialiseEnvironment = async () => {
        const signers = await ethers.getSigners();

        thirdParty = signers[0];
        embalmer = signers[1];
        paymentAccount = signers[2];
        archaeologist1 = signers[3];
        archaeologist2 = signers[4];
        arweaveAchaeologist = signers[5];
        receiverAddress = signers[6];

        ({ diamondAddress, sarcoToken } = await deployDiamond());

        await _distributeTokens();

        // Approve signers on the sarco token so transferFrom will work
        await _approveSpending();

        thirdPartyFacet = await ethers.getContractAt("ThirdPartyFacet", diamondAddress);

        // Setup archaeologists - add free bonds to their accounts
        await _setupArcheologists();

        // Create a sarcophagus with archaeologists assigned, with a 1 day resurrection time
        await _setupTestSarcophagus();
    }

    describe("clean()", () => {
        beforeEach(_initialiseEnvironment);

        it("Should distribute sum of cursed bonds of bad-acting archaeologists to embalmer and the address specified by cleaner", async () => {
            // Increasing by this much so that the sarco is definitely expired
            await time.increase(time.duration.years(sarcoResurrectionTimeInDays));

            let embalmerBalanceBefore = await sarcoToken.balanceOf(embalmer.address);
            let paymentDestinationBalance = await sarcoToken.balanceOf(paymentAccount.address);

            // before cleaning...
            expect(paymentDestinationBalance).to.eq(0);

            const tx = await thirdPartyFacet.connect(thirdParty).clean(sarcoId, paymentAccount.address);
            const receipt = await tx.wait();

            expect(receipt.status).to.equal(1);

            let embalmerBalanceAfter = await sarcoToken.balanceOf(embalmer.address);
            paymentDestinationBalance = await sarcoToken.balanceOf(paymentAccount.address);

            // after cleaning...
            expect(embalmerBalanceAfter.gt(embalmerBalanceBefore)).to.be.true;
            expect(paymentDestinationBalance.gt(0)).to.be.true;

            //TODO: Actually calculate sum, and verify on exact amounts instead
        });

        it("Should emit CleanUpSarcophagus on successful cleanup", async () => {
            // Increasing by this much so that the sarco is definitely expired
            await time.increase(time.duration.years(sarcoResurrectionTimeInDays));

            const tx = thirdPartyFacet.connect(thirdParty).clean(sarcoId, paymentAccount.address);

            expect(tx).to.emit(thirdPartyFacet, "CleanUpSarcophagus")
        });

        it("Should add all defaulting archaeologists to archaeologistCleanups storage on successful cleanup", async () => {
            // Increasing by this much so that the sarco is definitely expired
            await time.increase(time.duration.years(sarcoResurrectionTimeInDays));

            const tx = await thirdPartyFacet.connect(thirdParty).clean(sarcoId, paymentAccount.address);
            await tx.wait();

            // need access to appstorage here. Or add a getter function on ArchaeologistFacet?

            // for each defaulting archId,
            // verify that archaeologistCleanups[archId] contains sarcoId
            expect.fail();
        });

        it("Should revert if cleaning is attempted before sacro can be unwrapped or attempted within its resurrection grace period", async () => {
            // No time advancement before clean attempt
            const cleanTx = thirdPartyFacet.connect(thirdParty).clean(sarcoId, paymentAccount.address);
            await expect(cleanTx).to.be.revertedWith("SarcophagusNotCleanable()");

            // Increasing time up to just around the sarco's resurrection time means it will still be within grace window
            await time.increase(time.duration.days(sarcoResurrectionTimeInDays));

            const cleanTxAgain = thirdPartyFacet.connect(thirdParty).clean(sarcoId, paymentAccount.address);
            await expect(cleanTxAgain).to.be.revertedWith("SarcophagusNotCleanable()");
        });
    });

    describe("accuse()", () => {
        beforeEach(_initialiseEnvironment);

        context("when m unencrypted shard are provided", async () => {
            it("Should emit AccuseArchaeologist", async () => {
                const tx = thirdPartyFacet.connect(thirdParty).accuse(sarcoId, unencryptedShards.slice(0, 1));
                expect(tx).to.emit(thirdPartyFacet, "AccuseArchaeologist").withArgs(sarcoId, thirdParty.address, 0, 0, [archaeologist1.address, archaeologist2.address]);
            });

            it("Should update sarcophagus' state to DONE");
            it("Should distribute half the sum of the accused archaeologists' bounties and digging fees to accuser, and other half to embalmer");
            it("Should distribute the bounties and digging fees of unaccused archaeologists back to them, and un-curse their associated bonds");
        });

        it("Should revert with NotEnoughProof() if less than m unencrypted shards are provided", async () => {
            const tx = thirdPartyFacet.connect(thirdParty).accuse(sarcoId, []);
            await expect(tx).to.be.revertedWith("NotEnoughProof()");

            const tx2 = thirdPartyFacet.connect(thirdParty).accuse(sarcoId, [unencryptedShards[0]]);
            await expect(tx2).to.be.revertedWith("NotEnoughProof()");
        });

        it("Should revert with NotEnoughProof() if at least m unencrypted shards are provided, but one or more are invalid", async () => {
            const tx2 = thirdPartyFacet.connect(thirdParty).accuse(sarcoId, [unencryptedShards[0], hashedShards[1]]);
            await expect(tx2).to.be.revertedWith("NotEnoughProof()");
        });
    });

});