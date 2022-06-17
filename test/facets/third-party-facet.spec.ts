import "@nomiclabs/hardhat-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { deployDiamond } from "../../scripts/deploy-diamond";
import { ThirdPartyFacet, SarcoTokenMock, ArchaeologistFacet, EmbalmerFacet } from "../../typechain";
import { before } from "mocha";

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

    const freeBond = BigNumber.from(100);
    const storageFee = BigNumber.from(1);
    const diggingFee = BigNumber.from(1);
    const bounty = BigNumber.from(1);
    const resurrectionTime = BigNumber.from(1000);

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
            archaeologist1.address,
            freeBond,
            sarcoToken.address
        )
        archaeologistFacet.connect(arweaveAchaeologist).depositFreeBond(
            archaeologist1.address,
            freeBond,
            sarcoToken.address
        )
    }

    const _setupTestSarcophagus = async () => {
        const EmbalmerFacet = await ethers.getContractFactory("EmbalmerFacet");
        embalmerFacet = await EmbalmerFacet.deploy();
        await embalmerFacet.deployed();

        const sarcoId = "sarcoId";
        const arweavetxId = "arweavetxId";

        const archs = [
            { archAddress: archaeologist1.address, storageFee: storageFee, diggingFee: diggingFee, bounty: bounty, hashedShard: "hashedShard1" },
            { archAddress: archaeologist2.address, storageFee: storageFee, diggingFee: diggingFee, bounty: bounty, hashedShard: "hashedShard2" },
        ];

        const initSarcoTx = await embalmerFacet.initializeSarcophagus("Test Sarco", sarcoId, archs, arweaveAchaeologist.address, receiverAddress.address, resurrectionTime, sarcoToken.address, false);
        const initSarcoReceipt = await initSarcoTx.wait();

        const sign1 = await archaeologist1.signMessage(arweavetxId);
        console.log('sign1', sign1);


        // embalmerFacet.finalizeSarcophagus(sarcoId, [], {}, "", sarcoToken.address);
    }

    // Deploy the contracts and do stuff before each function, not before each
    // test. There is no need to do all of this before every single test.
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

        // Approve the signers on the sarco token so transferFrom will work
        _approveSpending();

        thirdPartyFacet = await ethers.getContractAt("ThirdPartyFacet", diamondAddress);

        // Setup archaeologists
        _setupArcheologists();

        // Create a sarcophagus with archaeologists assigned
        _setupTestSarcophagus();
    };

    describe.only("clean()", () => {
        before(beforeEachFunc);
        it("Should distribute all cursed bonds of bad-acting archaeologists to embalmer and caller-specified address", () => {
            thirdPartyFacet.clean("sarcoID", paymentAccount.address, sarcoToken.address)
        });
    });
});