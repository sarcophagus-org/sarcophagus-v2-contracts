/* eslint-disable node/no-unsupported-features/es-syntax */
import { expect } from "chai";
import { ethers } from "hardhat";
import time from "../utils/time";
import { TestArchaeologist } from "../fixtures/spawn-archaeologists";
import { initializeSarcoFixture } from "../fixtures/initialize-sarco-fixture";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ArchaeologistFacet, EmbalmerFacet } from "../../typechain";

/// //////////////////////////////////////////
/// // TESTS                                //
/// //////////////////////////////////////////
describe.skip("Create, Rewrap, Unwrap a Sarcophagus", () => {
  // Set up the signers for the tests
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
  context("Clean", () => {
    it("With 5 archaeologists", async () =>
      await _runCleanGasReports({
        shares: 5,
        threshold: 4,
      }));

    it("With 10 archaeologists", async () =>
      await _runCleanGasReports({
        shares: 10,
        threshold: 6,
      }));

    it("With 50 archaeologists", async () =>
      await _runCleanGasReports({
        shares: 50,
        threshold: 26,
      }));

    it("With 100 archaeologists", async () =>
      await _runCleanGasReports({
        shares: 100,
        threshold: 80,
      }));

    it("With 150 archaeologists", async () =>
      await _runCleanGasReports({
        shares: 150,
        threshold: 100,
      }));
  });

  context("Accuse", () => {
    it("With 5 archaeologists", async () =>
      await _runAccuseGasReports({
        shares: 5,
        threshold: 4,
      }));

    it("With 10 archaeologists", async () =>
      await _runAccuseGasReports({
        shares: 10,
        threshold: 13,
      }));

    it("With 50 archaeologists", async () =>
      await _runAccuseGasReports({
        shares: 50,
        threshold: 80,
      }));

    it("With 100 archaeologists", async () =>
      await _runAccuseGasReports({
        shares: 100,
        threshold: 80,
      }));

    it("With 150 archaeologists", async () =>
      await _runAccuseGasReports({
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
  const {
    sarcoId,
    archaeologists,
    archaeologistFacet,
    embalmer,
    embalmerFacet,
  } = await _runCreateSarcoTest(arg);
  await _runRewrapTest(sarcoId, embalmer, embalmerFacet);
  await _runUnwwrapTest(sarcoId, archaeologists, archaeologistFacet);
}

async function _runCleanGasReports(arg: { shares: number; threshold: number }) {
  const { sarcoId, thirdPartyFacet } = await _runCreateSarcoTest({
    shares: arg.shares,
    threshold: arg.threshold,
  });

  const thirdParty = (await ethers.getUnnamedSigners())[0];

  await time.increase(time.duration.years(1));
  await thirdPartyFacet.connect(thirdParty).clean(sarcoId, thirdParty.address);
}

async function _runAccuseGasReports(arg: {
  shares: number;
  threshold: number;
}) {
  const { sarcoId, archaeologists, thirdPartyFacet } =
    await _runCreateSarcoTest({
      shares: arg.shares,
      threshold: arg.threshold,
    });

  const thirdParty = (await ethers.getUnnamedSigners())[0];

  await thirdPartyFacet.connect(thirdParty).accuse(
    sarcoId,
    archaeologists.map((arch) =>
      ethers.utils.solidityKeccak256(["bytes"], [arch.unencryptedShard])
    ),
    thirdParty.address
  );
}

async function _runCreateSarcoTest(arg: { shares: number; threshold: number }) {
  const sarcoName = `Init sarco (${arg.shares})`;
  const {
    tx,
    archaeologists,
    sarcoId,
    signatures,
    arweaveSignature,
    arweaveTxId,
    embalmer,
    embalmerFacet,
    shards,
    archaeologistFacet,
    thirdPartyFacet,
  } = await initializeSarcoFixture(arg, sarcoName);

  tx.wait();

  const finTx = await embalmerFacet.connect(embalmer).finalizeSarcophagus(
    sarcoId,
    signatures.slice(1, signatures.length), // first signer is arweave archaeologist. Exclude their signature
    arweaveSignature,
    arweaveTxId
  );

  finTx.wait();

  // check shard lengths
  expect(shards[0].length).to.eq(shards[1].length).to.eq(1058);

  // check hashed shard lengths
  expect(archaeologists[0].hashedShard.length)
    .to.eq(archaeologists[0].hashedShard.length)
    .to.eq(66);

  return {
    sarcoId: sarcoId,
    archaeologists,
    arweaveSignature,
    archaeologistFacet,
    embalmer,
    embalmerFacet,
    thirdPartyFacet,
  };
}

async function _runRewrapTest(
  sarcoId: string,
  embalmer: SignerWithAddress,
  embalmerFacet: EmbalmerFacet
) {
  // Define a new resurrection time one week in the future
  const newResurrectionTime = (await time.latest()) + time.duration.weeks(1);

  await embalmerFacet
    .connect(embalmer)
    .rewrapSarcophagus(sarcoId, newResurrectionTime);
}

async function _runUnwwrapTest(
  sarcoId: string,
  archaeologists: TestArchaeologist[],
  archaeologistFacet: ArchaeologistFacet
) {
  await time.increase(time.duration.weeks(1));

  for await (const arch of archaeologists) {
    await archaeologistFacet
      .connect(arch.signer)
      .unwrapSarcophagus(sarcoId, arch.unencryptedShard);
  }
}
