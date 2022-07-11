/* eslint-disable node/no-unsupported-features/es-syntax */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, ContractTransaction, Signature } from "ethers";
import { ethers } from "hardhat";
import { deployDiamond } from "../../scripts/deploy-diamond";
import {
  ArchaeologistFacet,
  EmbalmerFacet,
  SarcoTokenMock,
  ThirdPartyFacet,
} from "../../typechain";
import { setupArchaeologists, sign } from "../utils/helpers";
import time from "../utils/time";
import { SignatureWithAccount } from "../../types";
import { BytesLike, solidityKeccak256 } from "ethers/lib/utils";

const sss = require("shamirs-secret-sharing");

let embalmerFacet: EmbalmerFacet;
let archaeologistFacet: ArchaeologistFacet;
let thirdPartyFacet: ThirdPartyFacet;
let embalmer: SignerWithAddress;
let recipient: SignerWithAddress;
let thirdParty: SignerWithAddress;
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
  unencryptedShard: BytesLike;
}

/// //////////////////////////////////////////
/// // TESTS                                //
/// //////////////////////////////////////////
describe.skip("Create, Rewrap, Unwrap a Sarcophagus", () => {
  // Set up the signers for the tests
  beforeEach(async () => {
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
    await _runGeneralGasReports({
      shares: 5,
      threshold: 4,
    });
  });

  it("With 10 archaeologists", async () => {
    await _runGeneralGasReports({
      shares: 10,
      threshold: 6,
    });
  });

  it("With 50 archaeologists", async () => {
    await _runGeneralGasReports({
      shares: 50,
      threshold: 26,
    });
  });

  it("With 100 archaeologists", async () => {
    await _runGeneralGasReports({
      shares: 100,
      threshold: 80,
    });
  });

  it("With 150 archaeologists", async () => {
    await _runGeneralGasReports({
      shares: 150,
      threshold: 100,
    });
  });
});

describe.skip("Third party functions", () => {
  // Set up the signers for the tests
  beforeEach(async () => {
    ({ diamondAddress, sarcoToken } = await deployDiamond());
    signers = await ethers.getSigners();

    // Set some roles to be used in the tests
    embalmer = signers[0];
    recipient = signers[1];
    thirdParty = signers[signers.length - 1];

    embalmerFacet = await ethers.getContractAt("EmbalmerFacet", diamondAddress);
    thirdPartyFacet = await ethers.getContractAt(
      "ThirdPartyFacet",
      diamondAddress
    );

    archaeologistFacet = await ethers.getContractAt(
      "ArchaeologistFacet",
      diamondAddress
    );
  });

  context("Clean", () => {
    it("With 5 archaeologists", async () =>
      await _runCleanGasReporst({
        shares: 5,
        threshold: 4,
      }));

    it("With 10 archaeologists", async () =>
      await _runCleanGasReporst({
        shares: 10,
        threshold: 6,
      }));

    it("With 50 archaeologists", async () =>
      await _runCleanGasReporst({
        shares: 50,
        threshold: 26,
      }));

    it("With 100 archaeologists", async () =>
      await _runCleanGasReporst({
        shares: 100,
        threshold: 80,
      }));

    it("With 150 archaeologists", async () =>
      await _runCleanGasReporst({
        shares: 150,
        threshold: 100,
      }));
  });

  context("Accuse", () => {
    it("With 5 archaeologists", async () =>
      await _runAccuseGasReporst({
        shares: 5,
        threshold: 4,
      }));

    it("With 10 archaeologists", async () =>
      await _runAccuseGasReporst({
        shares: 10,
        threshold: 13,
      }));

    it("With 50 archaeologists", async () =>
      await _runAccuseGasReporst({
        shares: 50,
        threshold: 80,
      }));

    it("With 100 archaeologists", async () =>
      await _runAccuseGasReporst({
        shares: 100,
        threshold: 80,
      }));

    it("With 150 archaeologists", async () =>
      await _runAccuseGasReporst({
        shares: 150,
        threshold: 100,
      }));
  });
});

/// //////////////////////////////////////////
/// // HELPERS                              //
/// //////////////////////////////////////////
async function _runGeneralGasReports(arg: {
  shares: number;
  threshold: number;
}) {
  const { sarcoId, archaeologists } = await _runCreateSarcoTest(arg);
  await _runRewrapTest(sarcoId);
  await _runUnwwrapTest(sarcoId, archaeologists);
}

async function _runCleanGasReporst(arg: { shares: number; threshold: number }) {
  const { sarcoId } = await _runCreateSarcoTest({
    shares: arg.shares,
    threshold: arg.threshold,
  });

  await time.increase(time.duration.years(1));
  await thirdPartyFacet.clean(sarcoId, thirdParty.address);
}

async function _runAccuseGasReporst(arg: {
  shares: number;
  threshold: number;
}) {
  const { sarcoId, archaeologists } = await _runCreateSarcoTest({
    shares: arg.shares,
    threshold: arg.threshold,
  });

  await thirdPartyFacet.accuse(
    sarcoId,
    archaeologists.map((arch) =>
      solidityKeccak256(["bytes"], [arch.unencryptedShard])
    ),
    thirdParty.address
  );
}

async function _runCreateSarcoTest(arg: {
  shares: number;
  threshold: number;
}): Promise<{
  sarcoId: string;
  archaeologists: TestArchaeologist[];
  arweaveSignature: Signature;
}> {
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

  const arweaveSignature = await sign(
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
}

async function _runRewrapTest(sarcoId: string) {
  // Define a new resurrection time one week in the future
  const newResurrectionTime = (await time.latest()) + time.duration.weeks(1);

  await embalmerFacet
    .connect(embalmer)
    .rewrapSarcophagus(sarcoId, newResurrectionTime);
}

async function _runUnwwrapTest(
  sarcoId: string,
  archaeologists: TestArchaeologist[]
) {
  await time.increase(time.duration.weeks(1));

  for await (const arch of archaeologists) {
    await archaeologistFacet
      .connect(arch.signer)
      .unwrapSarcophagus(sarcoId, arch.unencryptedShard);
  }
}

async function _spawnArchaologistsWithSignatures(
  shards: Buffer[],
  sarcoId: string
): Promise<[TestArchaeologist[], SignatureWithAccount[]]> {
  const archs: TestArchaeologist[] = [];
  const signatures: SignatureWithAccount[] = [];

  for (let i = 0; i < shards.length; i++) {
    const acc = signers[i + 2];

    // todo: confirm this data is correct
    const signature = await sign(acc, sarcoId, "bytes32");
    // const pubKey = utils.recoverPublicKey(
    //   ethers.utils.hashMessage(sarcoId),
    //   signature
    // );

    // const encryptedShardBuffer = await encrypt(_hexToBytes(pubKey), shards[i]);
    archs.push({
      hashedShard: ethers.utils.solidityKeccak256(["bytes"], [shards[i]]),
      unencryptedShard: shards[i],
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
