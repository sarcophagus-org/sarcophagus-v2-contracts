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
    let cleaner: SignerWithAddress;
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

    const _distributeTokens = async () => {
        sarcoToken.transfer(archaeologist1.address, balance);
        sarcoToken.transfer(archaeologist2.address, balance);
        sarcoToken.transfer(arweaveAchaeologist.address, balance);
        sarcoToken.transfer(embalmer.address, balance);
    }

    const _approveSpending = async () => {
        await sarcoToken
            .connect(cleaner)
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

        archaeologistFacet.connect(archaeologist1).depositFreeBond(
            archaeologist1.address,
            freeBond,
            sarcoToken.address
        )
        archaeologistFacet.connect(archaeologist2).depositFreeBond(
            archaeologist2.address,
            freeBond,
            sarcoToken.address
        )
        archaeologistFacet.connect(arweaveAchaeologist).depositFreeBond(
            arweaveAchaeologist.address,
            freeBond,
            sarcoToken.address
        )
    }

    const _setupTestSarcophagus = async () => {
        embalmerFacet = await ethers.getContractAt("EmbalmerFacet", diamondAddress);

        sarcoId = formatBytes32String("sarcoId");

        const archs = [
            { archAddress: archaeologist1.address, storageFee, diggingFee, bounty, hashedShard: formatBytes32String("hashedShard1") },
            { archAddress: archaeologist2.address, storageFee, diggingFee, bounty, hashedShard: formatBytes32String("hashedShard2") },
            { archAddress: arweaveAchaeologist.address, storageFee, diggingFee, bounty, hashedShard: formatBytes32String("hashedShard3") },
        ];

        const tomorrow = (await time.latest()) + time.duration.days(sarcoResurrectionTimeInDays);

        resurrectionTime = BigNumber.from(tomorrow);

        const arweavetxId = "arweavetxId";
        const initSarcoTx = await embalmerFacet.initializeSarcophagus("Test Sarco", sarcoId, archs, arweaveAchaeologist.address, receiverAddress.address, resurrectionTime, sarcoToken.address, false);

        await initSarcoTx.wait();

        const signature1 = await sign(archaeologist1, sarcoId, "bytes32");
        const signature2 = await sign(archaeologist2, sarcoId, "bytes32");
        const arweaveArchSig = await sign(arweaveAchaeologist, arweavetxId, "string");


        await embalmerFacet.finalizeSarcophagus(
            sarcoId,
            [
                { account: archaeologist1.address, ...signature1 },
                { account: archaeologist2.address, ...signature2 },
            ],
            arweaveArchSig,
            arweavetxId,
            sarcoToken.address
        );
    }

    // Deploy the contracts and setup initial state before each test
    const beforeEachFunc = async () => {
        const signers = await ethers.getSigners();

        cleaner = signers[0];
        embalmer = signers[1];
        paymentAccount = signers[2];
        archaeologist1 = signers[3];
        archaeologist2 = signers[4];
        arweaveAchaeologist = signers[5];
        receiverAddress = signers[6];

        diamondAddress = await deployDiamond();
        const SarcoToken = await ethers.getContractFactory("SarcoTokenMock");
        sarcoToken = await SarcoToken.deploy();
        await sarcoToken.deployed();

        // Add tokens to accounts
        await _distributeTokens();

        // Approve signers on the sarco token so transferFrom will work
        await _approveSpending();

        thirdPartyFacet = await ethers.getContractAt("ThirdPartyFacet", diamondAddress);

        // Setup archaeologists - add free bonds to their accounts
        await _setupArcheologists();

        // Create a sarcophagus with archaeologists assigned, with a 1 day resurrection time
        await _setupTestSarcophagus();
    };

    describe.only("clean()", () => {
        beforeEach(beforeEachFunc);
        it("Should distribute sum of cursed bonds of bad-acting archaeologists to embalmer and the address specified by cleaner", async () => {
            // Increasing by this much so that the sarco is definitely expired
            await time.increase(time.duration.years(sarcoResurrectionTimeInDays));

            const embalmerBalance = await sarcoToken.balanceOf(embalmer.address);
            const paymentDestinationBalance = await sarcoToken.balanceOf(paymentAccount.address);

            console.log(embalmerBalance.toString());
            console.log(paymentDestinationBalance.toString());

            const tx = await thirdPartyFacet.connect(cleaner).clean(sarcoId, paymentAccount.address, sarcoToken.address);
            await tx.wait();
            console.log((await sarcoToken.balanceOf(embalmer.address)).toString());
            console.log((await sarcoToken.balanceOf(paymentAccount.address)).toString());
            expect(true).to.eq(false);
        });

        it("Should revert if cleaning is attempted before sacro can be unwrapped or attempted within its resurrection grace period", async () => {
            // No time advancement before clean attempt
            const cleanTx = thirdPartyFacet.connect(cleaner).clean(sarcoId, paymentAccount.address, sarcoToken.address);
            await expect(cleanTx).to.be.revertedWith("SarcophagusNotCleanable()");

            // Increasing time up to just around the sarco's resurrection time means it will still be within grace window
            await time.increase(time.duration.days(sarcoResurrectionTimeInDays));

            const cleanTxAgain = thirdPartyFacet.connect(cleaner).clean(sarcoId, paymentAccount.address, sarcoToken.address);
            await expect(cleanTxAgain).to.be.revertedWith("SarcophagusNotCleanable()");
        });
    });

});