import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from "hardhat";
import {
  AdminFacet,
  ArchaeologistFacet,
  EmbalmerFacet,
  ERC20,
  IERC20,
  ThirdPartyFacet,
  ViewStateFacet,
} from "../../typechain";
import time from "../utils/time";
import { sign } from "../utils/helpers";
import { BytesLike } from "ethers/lib/utils";

const sss = require("shamirs-secret-sharing");

describe("accuse()", () => {
  it("Should revert on a nonexistent sarcophagus ID", async () => {
    const name = "jim";

    await deployments.fixture();
    const [signerAddress] = await getUnnamedAccounts();
    const signer = await ethers.getSigner(signerAddress);
    const diamond = await ethers.getContract("Diamond_DiamondProxy");
    const thirdPartyFacet = await ethers.getContractAt(
      "ThirdPartyFacet",
      diamond.address
    );

    const sarcoId = ethers.utils.solidityKeccak256(["string"], [name]);
    const tx = thirdPartyFacet
      .connect(signer)
      .accuse(sarcoId, [], signerAddress);

    await expect(tx).to.be.revertedWith(
      `SarcophagusDoesNotExist("${sarcoId}")`
    );
  });

  it("Should revert if the current time is past the resurrectionTime", async () => {
    const shares = 5;
    const threshold = 3;
    const maximumRewrapInterval = time.duration.weeks(4);
    const name = "jim";
    const resurrectionTime = (await time.latest()) + time.duration.weeks(1);
    const arweaveTxIds = ["FilePayloadTxId", "EncryptedShardTxId"];

    const sarcoId = ethers.utils.solidityKeccak256(["string"], [name]);
    const timestamp = await time.latest();

    // deploy contracts
    await deployments.fixture();

    // retrieve hardhat accounts for embalmer, recipient, and contract deployer
    const unnamedAccounts = await getUnnamedAccounts();
    const namedAccounts = await getNamedAccounts();
    const embalmer = await ethers.getSigner(unnamedAccounts[0]);
    const deployer = await ethers.getSigner(namedAccounts.deployer);
    const recipientAddress = unnamedAccounts[1];

    // retrieve contracts references through the diamond address
    const diamond = await ethers.getContract("Diamond_DiamondProxy");
    const embalmerFacet = (await ethers.getContractAt(
      "EmbalmerFacet",
      diamond.address
    )) as EmbalmerFacet;
    const archaeologistFacet = await ethers.getContractAt(
      "ArchaeologistFacet",
      diamond.address
    );
    const thirdPartyFacet = await ethers.getContractAt(
      "ThirdPartyFacet",
      diamond.address
    );

    // transfer 100k sarco to the embalmer and approve diamond spending on their behalf
    const sarcoToken = await ethers.getContract("SarcoTokenMock");
    await sarcoToken.transfer(
      embalmer.address,
      ethers.utils.parseEther("100000")
    );
    await sarcoToken
      .connect(embalmer)
      .approve(diamond.address, ethers.constants.MaxUint256);

    // generate the keyshares for the sarcophagus
    const outerKeyBuffer = Buffer.from(
      "ce6cb1ae13d79a053daba0e960411eba8648b7f7e81c196fd6b36980ce3b3419"
    );
    const keyshares: Buffer[] = sss.split(outerKeyBuffer, {
      shares,
      threshold,
    });

    // generate an archaeologist for each keyshare
    const archaeologists: {
      r: string;
      archAddress: string;
      s: string;
      unencryptedShardDoubleHash: string;
      v: number;
      diggingFee: string;
    }[] = await Promise.all(
      keyshares.map(async (share: Buffer, index: number) => {
        const archDiggingFee = "1000";

        const archaeologistSigner = await ethers.getSigner(
          unnamedAccounts[unnamedAccounts.length - 1 - index]
        );

        const hash = (data: BytesLike) =>
          ethers.utils.solidityKeccak256(["bytes"], [data]);
        // calculate the double hash of the keyshare
        const doubleHashedShare = hash(hash(share));
        const signature = await sign(
          archaeologistSigner,
          [
            arweaveTxIds[1],
            doubleHashedShare,
            maximumRewrapInterval.toString(),
            archDiggingFee,
            timestamp.toString(),
          ],
          ["string", "bytes32", "uint256", "uint256", "uint256"]
        );
        // Transfer 10,000 sarco tokens to each archaeologist to be put into free
        // bond, and approve spending
        await sarcoToken
          .connect(deployer)
          .transfer(
            archaeologistSigner.address,
            ethers.utils.parseEther("10000")
          );

        await sarcoToken
          .connect(archaeologistSigner)
          .approve(diamond.address, ethers.constants.MaxUint256);

        // Deposit 5000 tokens for each archaeologist so they're ready to be bonded
        await archaeologistFacet
          .connect(archaeologistSigner)
          .registerArchaeologist(
            "peerID",
            archDiggingFee,
            maximumRewrapInterval,
            ethers.utils.parseEther("5000")
          );

        return {
          archAddress: archaeologistSigner.address,
          diggingFee: archDiggingFee,
          unencryptedShardDoubleHash: doubleHashedShare,
          v: signature.v,
          r: signature.r,
          s: signature.s,
        };
      })
    );

    await embalmerFacet.connect(embalmer).createSarcophagus(
      sarcoId,
      {
        name,
        recipient: recipientAddress,
        resurrectionTime,
        maximumRewrapInterval,
        minShards: threshold,
        timestamp,
      },
      archaeologists,
      arweaveTxIds
    );

    await time.increaseTo(resurrectionTime);
    const tx = thirdPartyFacet
      .connect(embalmer)
      .accuse(sarcoId, [], embalmer.address);

    await expect(tx).to.be.revertedWith(`SarcophagusIsUnwrappable()`);
  });

  it("Should not refund bonds to other archaeologists or change sarcophagus state if less than k archaeologists have been accused", async () => {});
  it("Should refund digging fees allocated by embalmer to an accused archaeologist on their first accusal", async () => {});
  it("Should not pay out digging fees allocated by embalmer to an accused archaeologist if they've already been accused once", async () => {});
  it("Should not pay out any funds on the second accusal of an archaeologist who has already been accused", async () => {});
  it("Should allow accusal of 2 archaeologists on a 3 of 5 sarcophagus without freeing all other archaeologists", async () => {});
  it("Should free all unaccused archaeologists upon successful accusal of 3 archaeologists on a 3 of 5 sarcophagus and update state to accused", async () => {});
  it("Should free all unaccused archaeologists upon successful accusal of 1 archaeologist on a 3 of 5 sarcophagus where 2 have been accused on a previous call and update state to accused", async () => {});
});
