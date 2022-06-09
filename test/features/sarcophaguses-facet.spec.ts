import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { deployDiamond } from "../../scripts/deploy-diamond";
import {
  ArchaeologistsFacet,
  SarcophagusesFacet,
  SarcoTokenMock,
} from "../../typechain";

const registerArchaeologist = async (
  archaeologist: SignerWithAddress,
  archaeologistsFacet: ArchaeologistsFacet,
  sarcoToken: SarcoTokenMock
): Promise<void> => {
  const archaeologistsWallet = ethers.Wallet.createRandom();
  const unslicedPublicKey = archaeologistsWallet.publicKey;
  const publicKey = ethers.utils.hexDataSlice(unslicedPublicKey, 1);

  const endpoint = "https://test.com/post";
  const paymentAddress = archaeologistsWallet.address;
  const feePerByte = 10;
  const minimumBounty = 50;
  const minimumDiggingFee = 5;
  const maximumResurrectionTime = 604800 * 2; // 2 weeks
  const freeBond = 150;

  // Transfer token to archaeologist
  await sarcoToken.transfer(
    archaeologist.address,
    BigNumber.from("1000000000000")
  );

  // Register archaeologist
  await archaeologistsFacet
    .connect(archaeologist)
    .registerArchaeologist(
      publicKey,
      endpoint,
      paymentAddress,
      feePerByte,
      minimumBounty,
      minimumDiggingFee,
      maximumResurrectionTime,
      freeBond,
      sarcoToken.address,
      { from: archaeologist.address }
    );
};

describe("SarcophagusesFacet", () => {
  let signers: SignerWithAddress[];
  let diamondAddress: string;
  let sarcophagusesFacet: SarcophagusesFacet;
  let archaeologistsFacet: ArchaeologistsFacet;
  let embalmer: SignerWithAddress;
  let archaeologist: SignerWithAddress;
  let sarcoToken: SarcoTokenMock;

  beforeEach(async () => {
    signers = await ethers.getSigners();

    embalmer = signers[0];
    archaeologist = signers[1];

    diamondAddress = await deployDiamond();
    sarcophagusesFacet = await ethers.getContractAt(
      "SarcophagusesFacet",
      diamondAddress
    );
    archaeologistsFacet = await ethers.getContractAt(
      "ArchaeologistsFacet",
      diamondAddress
    );
    const SarcoToken = await ethers.getContractFactory("SarcoTokenMock");
    sarcoToken = await SarcoToken.deploy();
    await sarcoToken.deployed();

    await sarcoToken
      .connect(archaeologist)
      .approve(archaeologistsFacet.address, BigNumber.from("10000000000000"));

    // register archaeologist
    await registerArchaeologist(archaeologist, archaeologistsFacet, sarcoToken);
  });

  it("should successfully create sarcophagus", async () => {
    const resurrectionTimeDelta = 604800; // 1 week
    const name = "King Tut";
    const resurrectionTime = BigNumber.from(
      Math.ceil(Date.now() / 1000 + resurrectionTimeDelta)
    );
    const storageFee = BigNumber.from(5);
    const diggingFee = BigNumber.from(10);
    const bounty = BigNumber.from(100);

    const recipientWallet = ethers.Wallet.createRandom();
    const publicKey = ethers.utils.hexDataSlice(recipientWallet.publicKey, 1);

    const approveTx = await sarcoToken
      .connect(embalmer)
      .approve(sarcophagusesFacet.address, BigNumber.from("10000000000000"));
    await approveTx.wait();

    const transferTx = await sarcoToken.transfer(
      embalmer.address,
      BigNumber.from("1000000000000")
    );
    await transferTx.wait();

    const tx = await sarcophagusesFacet
      .connect(embalmer)
      .createSarcophagus(
        name,
        archaeologist.address,
        resurrectionTime,
        storageFee,
        diggingFee,
        bounty,
        ethers.constants.HashZero,
        publicKey,
        sarcoToken.address
      );

    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
  });
});
