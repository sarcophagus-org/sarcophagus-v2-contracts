import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, ContractTransaction, Signature } from "ethers";
import { ethers } from "hardhat";
import { deployDiamond } from "../../scripts/deploy-diamond";
import {
  ArchaeologistFacet,
  EmbalmerFacet,
  SarcoTokenMock,
  ViewStateFacet,
} from "../../typechain";
import { setupArchaeologists } from "../utils/helpers";
import time from "../utils/time";
import { SignatureWithAccount } from "../../types";
import { hexlify } from "ethers/lib/utils";

const sss = require("shamirs-secret-sharing");

let embalmerFacet: EmbalmerFacet;
let archaeologistFacet: ArchaeologistFacet;
let viewStateFacet: ViewStateFacet;
let embalmer: SignerWithAddress;
let recipient: SignerWithAddress;
let arweaveArchaeologist: SignerWithAddress;
let diamondAddress: string;
let sarcoToken: SarcoTokenMock;
let signers: SignerWithAddress[];

interface TestArchaeologist {
  signer: SignerWithAddress;
  storageFee: BigNumber;
  diggingFee: BigNumber;
  bounty: BigNumber;
  hashedShard: string;
}

/// //////////////////////////////////////////
/// // TESTS                                //
/// //////////////////////////////////////////
describe("Creating a Sarcophagus", () => {
  // Set up the signers for the tests
  before(async () => {
    ({ diamondAddress, sarcoToken } = await deployDiamond());
    signers = await ethers.getSigners();

    // Set some roles to be used in the tests
    embalmer = signers[0];
    recipient = signers[1];

    embalmerFacet = await ethers.getContractAt("EmbalmerFacet", diamondAddress);

    archaeologistFacet = await ethers.getContractAt(
      "ArchaeologistFacet",
      diamondAddress
    );
  });

  it("With 5 archaeologists", async () => {
    const { sarcoId } = await _runCreateSarcoTest({ shares: 5, threshold: 4 });

    // Define a new resurrection time one week in the future
    const newResurrectionTime = BigNumber.from(
      Date.now() + 60 * 60 * 24 * 7 * 1000
    );

    // Rewrap the sarcophagus
    await embalmerFacet
      .connect(embalmer)
      .rewrapSarcophagus(sarcoId, newResurrectionTime);
  });

  it("With 10 archaeologists", async () => {
    await _runCreateSarcoTest({ shares: 10, threshold: 6 });
  });

  it("With 50 archaeologists", async () => {
    await _runCreateSarcoTest({ shares: 50, threshold: 26 });
  });

  it("With 100 archaeologists", async () => {
    await _runCreateSarcoTest({ shares: 100, threshold: 80 });
  });

  it("With 150 archaeologists", async () => {
    await _runCreateSarcoTest({ shares: 150, threshold: 100 });
  });
});

/// //////////////////////////////////////////
/// // HELPERS                              //
/// //////////////////////////////////////////
const _runCreateSarcoTest = async (arg: {
  shares: number;
  threshold: number;
}): Promise<{
  sarcoId: string;
  archaeologists: TestArchaeologist[];
  arweaveSignature: Signature;
}> => {
  // const publicKey =
  //   "-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANFcUwtJSlCR65MqRqRmbJjBSuAhyxmN\nXmEV0imtcsKRiBHhHIxAAN/bw1tfzpHvAoM47iR11S7XsEfMjyW/nokCAwEAAQ==\n----- END PUBLIC KEY-----";
  const privateKey =
    "-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEA0VxTC0lKUJHrkypG\npGZsmMFK4CHLGY1eYRXSKa1ywpGIEeEcjEAA39vDW1/Oke8CgzjuJHXVLtewR8yP\nJb+eiQIDAQABAkEApXBbfzOvMfPdQDHMGOWHMz6rOGn74HlB914S8TRK10xTG0wG\n/4Y6pUJbRRqOanxkLgCBBZS9OvTF+dRf/VTVwQIhAPDB1OR8mXPgkoEsfJyBk5dw\n5uLnyN/jJyeaogSXILxFAiEA3p2fBYYVlbMnzNVi3yaglyxRiN0k2Oc7tfusPhtH\n93UCIQDQCj5jvkN/vUP7uSxotROLXnU1B6MtzATOlTGBk/ImnQIgZNquH7eGceLP\npjoKaCS83qBCdCoUNnxUDfduKlj7ur0CIBU7jkKqIw83yTJsLxWSiu9n07LbWss6\nGXukOtNeIAeZ\n-----END PRIVATE KEY-----";

  const secret = Buffer.from(privateKey);
  const shards: Buffer[] = sss.split(secret, arg);

  // const recovered = sss.combine(shards.slice(0, 2));
  // console.log(recovered.toString());

  const sarcoName = `Init sarco (${arg.shares})`;
  const sarcoId = ethers.utils.solidityKeccak256(["string"], [sarcoName]);

  const resurrectionTimeInFuture =
    (await time.latest()) + time.duration.weeks(1);

  const [archaeologists, signatures] = await _spawnArchaologistsWithSignatures(
    shards,
    sarcoId
  );

  await setupArchaeologists(
    archaeologistFacet,
    archaeologists.map((a) => a.signer),
    diamondAddress,
    embalmer,
    sarcoToken
  );

  // Choose arweave archaeologist.
  arweaveArchaeologist = archaeologists[0].signer;

  const tx = await _initializeSarcophagus(
    sarcoName,
    BigNumber.from(resurrectionTimeInFuture),
    sarcoId,
    archaeologists,
    arweaveArchaeologist.address,
    arg.threshold
  );

  tx.wait();

  const arweaveSignature = await _sign(
    arweaveArchaeologist,
    "arweaveTxId",
    "string"
  );

  const finTx = await embalmerFacet.finalizeSarcophagus(
    sarcoId,
    signatures.slice(1, signatures.length), // first signer is arweave archaeologist. Exclude their signature
    arweaveSignature,
    "arweaveTxId"
  );
  finTx.wait();

  // check shard lengths
  expect(shards[0].length).to.eq(shards[1].length).to.eq(1058);

  // check hashed shard lengths
  expect(archaeologists[0].hashedShard.length)
    .to.eq(archaeologists[0].hashedShard.length)
    .to.eq(66);

  return { sarcoId, archaeologists, arweaveSignature };
};

async function _sign(
  signer: SignerWithAddress,
  message: string,
  type: string
): Promise<Signature> {
  const dataHex = ethers.utils.defaultAbiCoder.encode([type], [message]);
  const dataHash = ethers.utils.keccak256(dataHex);
  const dataHashBytes = ethers.utils.arrayify(dataHash);
  const signature = await signer.signMessage(dataHashBytes);
  return ethers.utils.splitSignature(signature);
}

// function _hexToBytes(hex: string, pad = false) {
//   const byteArray = utils.arrayify(hex);
//   if (pad) {
//     const padByte = new Uint8Array([4]);
//     return Buffer.from(new Uint8Array([...padByte, ...byteArray]));
//   } else {
//     return Buffer.from(byteArray);
//   }
// }

async function _spawnArchaologistsWithSignatures(
  shards: Buffer[],
  sarcoId: string
): Promise<[TestArchaeologist[], SignatureWithAccount[]]> {
  const archs: TestArchaeologist[] = [];
  const signatures: SignatureWithAccount[] = [];

  for (let i = 0; i < shards.length; i++) {
    const acc = signers[i + 2];

    // todo: confirm this encryption is correct
    const signature = await _sign(acc, sarcoId, "bytes32");
    // const pubKey = utils.recoverPublicKey(
    //   ethers.utils.hashMessage(sarcoId),
    //   signature
    // );

    // const encryptedShardBuffer = await encrypt(_hexToBytes(pubKey), shards[i]);
    archs.push({
      hashedShard: ethers.utils.solidityKeccak256(
        ["string"],
        [hexlify(shards[i])]
      ),
      // hashedShard: hexlify(encryptedShardBuffer),
      signer: acc,
      storageFee: ethers.utils.parseEther("20"),
      diggingFee: ethers.utils.parseEther("10"),
      bounty: ethers.utils.parseEther("100"),
    });

    signatures.push({ ...signature, account: acc.address });
  }

  return [archs, signatures];
}

const _initializeSarcophagus = async (
  name: string,
  resurrectionTime: BigNumber,
  identifier: string,
  archaeologists: TestArchaeologist[],
  arweaveArchAddress: string,
  minShards: number
): Promise<ContractTransaction> => {
  const canBeTransferred = true;

  // Create a sarcophagus as the embalmer
  const tx = await embalmerFacet.connect(embalmer).initializeSarcophagus(
    name,
    identifier,
    archaeologists.map((a) => ({
      archAddress: a.signer.address,
      storageFee: a.storageFee,
      diggingFee: a.diggingFee,
      bounty: a.bounty,
      hashedShard: a.hashedShard,
    })),
    arweaveArchAddress,
    recipient.address,
    resurrectionTime,
    canBeTransferred,
    minShards
  );

  return tx;
};
