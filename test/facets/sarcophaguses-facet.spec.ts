import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract, ContractReceipt, utils } from "ethers";
import { Interface } from "ethers/lib/utils";
import { ethers } from "hardhat";
import {
  DiamondCutFacet,
  DiamondLoupeFacet,
  LibPrivateKeys,
  SarcophagusesFacet,
  SarcoTokenMock,
  ArchaeologistsFacet,
} from "../../typechain";
import { LibUtils } from "../../typechain/LibUtils";
const {
  deployDiamond,
} = require("../../contracts/diamond/scripts/deploy-diamond.js");

enum FacetCutAction {
  Add,
  Replace,
  Remove,
}

const getSelectors = (contract: Contract): string[] => {
  const iface = contract.interface;
  const signatures = Object.keys(iface.functions);
  return signatures.map((x) => iface.getSighash(x));
};

const deployLibPrivateKeys = async (): Promise<LibPrivateKeys> => {
  const LibPrivateKeys = await ethers.getContractFactory("LibPrivateKeys");
  const libPrivateKeys = await LibPrivateKeys.deploy();
  await libPrivateKeys.deployed();
  return libPrivateKeys;
};

const deploySarcoTokenMock = async (): Promise<SarcoTokenMock> => {
  const SarcoTokenMock = await ethers.getContractFactory("SarcoTokenMock");
  const sarcoTokenMock = await SarcoTokenMock.deploy();
  await sarcoTokenMock.deployed();
  return sarcoTokenMock;
};

const deployLibUtils = async (): Promise<LibUtils> => {
  const LibUtils = await ethers.getContractFactory("LibUtils");
  const libUtils = await LibUtils.deploy();
  await libUtils.deployed();
  return libUtils;
};

const deploySarcophagusFacet = async (
  libPrivateKeys: LibPrivateKeys,
  libUtils: LibUtils
): Promise<SarcophagusesFacet> => {
  const SarcophagusesFacet = await ethers.getContractFactory(
    "SarcophagusesFacet",
    {
      libraries: {
        LibPrivateKeys: libPrivateKeys.address,
        LibUtils: libUtils.address,
      },
    }
  );
  const sarcophagusesFacet = await SarcophagusesFacet.deploy();
  await sarcophagusesFacet.deployed();
  return sarcophagusesFacet;
};

const deployArchaeologistsFacet = async (
  libUtils: LibUtils
): Promise<ArchaeologistsFacet> => {
  const ArchaeologistsFacet = await ethers.getContractFactory(
    "ArchaeologistsFacet",
    {
      libraries: {
        LibUtils: libUtils.address,
      },
    }
  );
  const archaeologistsFacet = await ArchaeologistsFacet.deploy();
  await archaeologistsFacet.deployed();
  return archaeologistsFacet;
};

const diamondCutSarcophagusesFacet = async (
  sarcophagusesFacet: SarcophagusesFacet,
  diamondCutFacet: DiamondCutFacet
): Promise<ContractReceipt> => {
  const selectors = getSelectors(sarcophagusesFacet);
  const tx = await diamondCutFacet.diamondCut(
    [
      {
        facetAddress: sarcophagusesFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors,
      },
    ],
    ethers.constants.AddressZero,
    "0x",
    { gasLimit: 800000 }
  );

  return await tx.wait();
};

const diamondCutArchaeologistsFacet = async (
  archaeologistsFacet: ArchaeologistsFacet,
  diamondCutFacet: DiamondCutFacet
): Promise<ContractReceipt> => {
  const selectors = getSelectors(archaeologistsFacet);
  const tx = await diamondCutFacet.diamondCut(
    [
      {
        facetAddress: archaeologistsFacet.address,
        action: FacetCutAction.Add,
        functionSelectors: selectors,
      },
    ],
    ethers.constants.AddressZero,
    "0x",
    { gasLimit: 800000 }
  );

  return await tx.wait();
};

const registerArchaeologist = async (
  archaeologist: SignerWithAddress,
  archaeologistsFacet: ArchaeologistsFacet,
  sarcoToken: SarcoTokenMock
) => {
  const archaeologistsWallet = ethers.Wallet.createRandom();
  const unslicedPublicKey = archaeologistsWallet.publicKey;
  const publicKey = ethers.utils.hexDataSlice(unslicedPublicKey, 1);

  const endpoint = "https://test.com/post";
  const paymentAddress = archaeologistsWallet.address;
  const feePerByte = 10;
  const minimumBounty = 50;
  const minimumDiggingFee = 5;
  const maximumResurrectionTime = 2379882399; // 5-31-45
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

describe.only("SarcophagusesFacet", () => {
  let signers: SignerWithAddress[];
  let diamondAddress: string;
  let diamondCutFacet: DiamondCutFacet;
  let diamondLoupeFacet: DiamondLoupeFacet;
  let facetAddresses: string[] = [];
  let libUtils: LibUtils;
  let libPrivateKeys: LibPrivateKeys;
  let sarcophagusesFacet: SarcophagusesFacet;
  let archaeologistsFacet: ArchaeologistsFacet;
  let embalmer: SignerWithAddress;
  let archaeologist: SignerWithAddress;
  let recipient: SignerWithAddress;
  let token: SarcoTokenMock;

  beforeEach(async () => {
    signers = await ethers.getSigners();

    embalmer = signers[0];
    archaeologist = signers[1];
    recipient = signers[2];

    diamondAddress = await deployDiamond();
    diamondCutFacet = await ethers.getContractAt(
      "DiamondCutFacet",
      diamondAddress
    );
    diamondLoupeFacet = await ethers.getContractAt(
      "DiamondLoupeFacet",
      diamondAddress
    );

    libUtils = await deployLibUtils();
    libPrivateKeys = await deployLibPrivateKeys();
    token = await deploySarcoTokenMock();
    sarcophagusesFacet = await deploySarcophagusFacet(libPrivateKeys, libUtils);
    archaeologistsFacet = await deployArchaeologistsFacet(libUtils);
    await diamondCutSarcophagusesFacet(sarcophagusesFacet, diamondCutFacet);
    await diamondCutArchaeologistsFacet(archaeologistsFacet, diamondCutFacet);

    facetAddresses = await diamondLoupeFacet.facetAddresses();

    const approveTx = await token
      .connect(archaeologist)
      .approve(diamondAddress, BigNumber.from("10000000000000"));
    const reciept = await approveTx.wait();

    // register archaeologist
    // await registerArchaeologist(archaeologist, archaeologistsFacet, token);
  });

  it("should pass", async () => {
    const resurrectionTimeDelta = 604800; // 1 week
    const name = "King Tut";
    const resurrectionTime = BigNumber.from(Date.now() + resurrectionTimeDelta);
    const storageFee = BigNumber.from(5);
    const diggingFee = BigNumber.from(10);
    const bounty = BigNumber.from(100);
    const bytes = utils.toUtf8Bytes("inner_encrypted_payload");
    const singleHash = Buffer.from(utils.keccak256(bytes));
    const sarcoId = Buffer.from(utils.keccak256(singleHash));

    const recipientWallet = ethers.Wallet.createRandom();
    const privateKeyBytes = utils.toUtf8Bytes(recipientWallet.privateKey);
    const recipientPublicKey = utils.toUtf8Bytes(recipientWallet.publicKey);

    const tx = await sarcophagusesFacet.createSarcophagus(
      name,
      archaeologist.address,
      resurrectionTime,
      storageFee,
      diggingFee,
      bounty,
      ethers.constants.HashZero,
      recipientPublicKey,
      token.address
    );

    console.log(
      "🚀 ~ file: sarcophaguses-facet.spec.ts ~ line 158 ~ it ~ tx",
      tx
    );
  });
});
