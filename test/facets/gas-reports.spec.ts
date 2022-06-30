import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { deployDiamond } from "../../scripts/deploy-diamond";
import {
  ArchaeologistFacet,
  EmbalmerFacet,
  SarcoTokenMock,
} from "../../typechain";
import { setupArchaeologists } from "../utils/helpers";
import time from "../utils/time";

const sss = require("shamirs-secret-sharing");

describe.skip("Creating a Sarcophagus", () => {
  let embalmerFacet: EmbalmerFacet;
  let archaeologistFacet: ArchaeologistFacet;
  let embalmer: SignerWithAddress;
  let archaeologists: SignerWithAddress[];
  let recipient: SignerWithAddress;
  let arweaveArchaeologist: SignerWithAddress;
  let sarcoToken: SarcoTokenMock;
  let signers: SignerWithAddress[];

  // Define arcaeologist fees
  const archaeologistsFees = [
    {
      storageFee: ethers.utils.parseEther("20"),
      diggingFee: ethers.utils.parseEther("10"),
      bounty: ethers.utils.parseEther("1000"),
    },
    {
      storageFee: ethers.utils.parseEther("25"),
      diggingFee: ethers.utils.parseEther("8"),
      bounty: ethers.utils.parseEther("112"),
    },
    {
      storageFee: ethers.utils.parseEther("21"),
      diggingFee: ethers.utils.parseEther("9"),
      bounty: ethers.utils.parseEther("1050"),
    },
    {
      storageFee: ethers.utils.parseEther("51"),
      diggingFee: ethers.utils.parseEther("19"),
      bounty: ethers.utils.parseEther("1105"),
    },
    {
      storageFee: ethers.utils.parseEther("31"),
      diggingFee: ethers.utils.parseEther("5"),
      bounty: ethers.utils.parseEther("1205"),
    },
    {
      storageFee: ethers.utils.parseEther("20"),
      diggingFee: ethers.utils.parseEther("10"),
      bounty: ethers.utils.parseEther("1000"),
    },
    {
      storageFee: ethers.utils.parseEther("25"),
      diggingFee: ethers.utils.parseEther("8"),
      bounty: ethers.utils.parseEther("112"),
    },
    {
      storageFee: ethers.utils.parseEther("21"),
      diggingFee: ethers.utils.parseEther("9"),
      bounty: ethers.utils.parseEther("1050"),
    },
    {
      storageFee: ethers.utils.parseEther("51"),
      diggingFee: ethers.utils.parseEther("19"),
      bounty: ethers.utils.parseEther("1105"),
    },
    {
      storageFee: ethers.utils.parseEther("31"),
      diggingFee: ethers.utils.parseEther("5"),
      bounty: ethers.utils.parseEther("1205"),
    },
  ];

  // Set up the signers for the tests
  before(async () => {
    let diamondAddress: string;
    ({ diamondAddress, sarcoToken } = await deployDiamond());
    signers = await ethers.getSigners();

    // Set some roles to be used in the tests
    embalmer = signers[0];
    archaeologists = [
      signers[1],
      signers[2],
      signers[3],
      signers[4],
      signers[5],
      signers[7],
      signers[8],
      signers[9],
      signers[10],
      signers[11],
    ];
    arweaveArchaeologist = signers[1];
    recipient = signers[6];

    embalmerFacet = await ethers.getContractAt("EmbalmerFacet", diamondAddress);

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

  /**
   * Create a sarcophagus.
   */
  const _initializeSarcophagus = async (
    name: string,
    resurrectionTime: BigNumber,
    identifier: string,
    archaeologists: SignerWithAddress[],
    minShards: number
  ): Promise<ContractTransaction> => {
    // Define archaeologist objects to be passed into the sarcophagus
    const archaeologistObjects = archaeologists.map((a, i) => ({
      archAddress: a.address,
      storageFee: archaeologistsFees[i].storageFee,
      diggingFee: archaeologistsFees[i].diggingFee,
      bounty: archaeologistsFees[i].bounty,
      hashedShard: ethers.utils.solidityKeccak256(["string"], [a.address]),
    }));

    const canBeTransferred = true;

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
        canBeTransferred,
        minShards
      );

    return tx;
  };

  // const publicKey =
  //   "-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANFcUwtJSlCR65MqRqRmbJjBSuAhyxmN\nXmEV0imtcsKRiBHhHIxAAN/bw1tfzpHvAoM47iR11S7XsEfMjyW/nokCAwEAAQ==\n----- END PUBLIC KEY-----";
  const privateKey =
    "-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEA0VxTC0lKUJHrkypG\npGZsmMFK4CHLGY1eYRXSKa1ywpGIEeEcjEAA39vDW1/Oke8CgzjuJHXVLtewR8yP\nJb+eiQIDAQABAkEApXBbfzOvMfPdQDHMGOWHMz6rOGn74HlB914S8TRK10xTG0wG\n/4Y6pUJbRRqOanxkLgCBBZS9OvTF+dRf/VTVwQIhAPDB1OR8mXPgkoEsfJyBk5dw\n5uLnyN/jJyeaogSXILxFAiEA3p2fBYYVlbMnzNVi3yaglyxRiN0k2Oc7tfusPhtH\n93UCIQDQCj5jvkN/vUP7uSxotROLXnU1B6MtzATOlTGBk/ImnQIgZNquH7eGceLP\npjoKaCS83qBCdCoUNnxUDfduKlj7ur0CIBU7jkKqIw83yTJsLxWSiu9n07LbWss6\nGXukOtNeIAeZ\n-----END PRIVATE KEY-----";

  it("With 5 archaeologists", async () => {
    const _archs = archaeologists.slice(0, 6);
    const shares = _archs.length;
    const threshold = 4;


    const secret = Buffer.from(privateKey);
    const shards: Buffer[] = sss.split(secret, { shares, threshold });

    // const recovered = sss.combine(shards.slice(0, 2));
    // console.log(recovered.toString());

    const sarcoName = "Init sarco (5)";
    const sarcoId = ethers.utils.solidityKeccak256(["string"], [sarcoName]);

    const resurrectionTimeInFuture =
      (await time.latest()) + time.duration.weeks(1);

    const tx = await _initializeSarcophagus(
      sarcoName,
      BigNumber.from(resurrectionTimeInFuture),
      sarcoId,
      _archs,
      threshold
    );

    tx.wait();

    expect(shards[0].length).to.eq(shards[1].length).to.eq(1058);
  });

  it("With 10 archaeologists", async () => {
    const shares = archaeologists.length;
    const threshold = 6;

    const secret = Buffer.from(privateKey);
    const shards: Buffer[] = sss.split(secret, { shares, threshold });

    // const recovered = sss.combine(shards.slice(0, 2));
    // console.log(recovered.toString());

    const sarcoName = "Init sarco (10)";
    const sarcoId = ethers.utils.solidityKeccak256(["string"], [sarcoName]);

    const resurrectionTimeInFuture =
      (await time.latest()) + time.duration.weeks(1);

    const tx = await _initializeSarcophagus(
      sarcoName,
      BigNumber.from(resurrectionTimeInFuture),
      sarcoId,
      archaeologists,
      threshold
    );

    tx.wait();

    expect(shards[0].length).to.eq(shards[1].length).to.eq(1058);
  });
});
