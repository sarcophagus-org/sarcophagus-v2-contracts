// import { expect } from "chai";
// import { ethers } from "hardhat";
// import time from "../utils/time";
// import { TestSignatory } from "../fixtures/spawn-signatories";
// import { createVaultFixture } from "../fixtures/create-vault-fixture";
// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { SignatoryFacet, vaultOwnerFacet } from "../../typechain";

// /// //////////////////////////////////////////
// /// // TESTS                                //
// /// //////////////////////////////////////////
// describe.skip("Gas Reports: Create, Rewrap, Unwrap a Vault", () => {
//   // Set up the signers for the tests
//   it("With 5 signatories", async () => {
//     await _runGeneralGasReports({
//       shares: 5,
//       threshold: 4,
//     });
//   });

//   it("With 10 signatories", async () => {
//     await _runGeneralGasReports({
//       shares: 10,
//       threshold: 6,
//     });
//   });

//   it("With 50 signatories", async () => {
//     await _runGeneralGasReports({
//       shares: 50,
//       threshold: 26,
//     });
//   });

//   it("With 100 signatories", async () => {
//     await _runGeneralGasReports({
//       shares: 100,
//       threshold: 80,
//     });
//   });

//   it("With 150 signatories", async () => {
//     await _runGeneralGasReports({
//       shares: 150,
//       threshold: 100,
//     });
//   });
// });

// describe.skip("Gas Reports: Third party functions", () => {
//   context("Clean", () => {
//     it("With 5 signatories", async () =>
//       await _runCleanGasReports({
//         shares: 5,
//         threshold: 4,
//       }));

//     it("With 10 signatories", async () =>
//       await _runCleanGasReports({
//         shares: 10,
//         threshold: 6,
//       }));

//     it("With 50 signatories", async () =>
//       await _runCleanGasReports({
//         shares: 50,
//         threshold: 26,
//       }));

//     it("With 100 signatories", async () =>
//       await _runCleanGasReports({
//         shares: 100,
//         threshold: 80,
//       }));

//     it("With 150 signatories", async () =>
//       await _runCleanGasReports({
//         shares: 150,
//         threshold: 100,
//       }));
//   });

//   context("Accuse", () => {
//     it("With 5 signatories", async () =>
//       await _runAccuseGasReports({
//         shares: 5,
//         threshold: 4,
//       }));

//     it("With 10 signatories", async () =>
//       await _runAccuseGasReports({
//         shares: 10,
//         threshold: 5,
//       }));

//     it("With 50 signatories", async () =>
//       await _runAccuseGasReports({
//         shares: 50,
//         threshold: 40,
//       }));

//     it("With 100 signatories", async () =>
//       await _runAccuseGasReports({
//         shares: 100,
//         threshold: 80,
//       }));

//     it("With 150 signatories", async () =>
//       await _runAccuseGasReports({
//         shares: 150,
//         threshold: 100,
//       }));
//   });
// });

// /// //////////////////////////////////////////
// /// // HELPERS                              //
// /// //////////////////////////////////////////
// async function _runGeneralGasReports(arg: { shares: number; threshold: number }) {
//   const { vaultId, signatories, signatoryFacet, vaultOwner, vaultOwnerFacet } =
//     await _runCreateVaultTest(arg);
//   await _runRewrapTest(vaultId, vaultOwner, vaultOwnerFacet);
//   await _runUnwwrapTest(vaultId, signatories, signatoryFacet);
// }

// async function _runCleanGasReports(arg: { shares: number; threshold: number }) {
//   const { vaultId, thirdPartyFacet } = await _runCreateVaultTest({
//     shares: arg.shares,
//     threshold: arg.threshold,
//   });

//   const thirdParty = (await ethers.getUnnamedSigners())[0];

//   await time.increase(time.duration.years(1));
//   await thirdPartyFacet.connect(thirdParty).clean(vaultId, thirdParty.address);
// }

// async function _runAccuseGasReports(arg: { shares: number; threshold: number }) {
//   const { vaultId, signatories, thirdPartyFacet } = await _runCreateVaultTest({
//     shares: arg.shares,
//     threshold: arg.threshold,
//   });

//   const thirdParty = (await ethers.getUnnamedSigners())[0];

//   await thirdPartyFacet.connect(thirdParty).accuse(
//     vaultId,
//     signatories.map(arch => ethers.utils.solidityKeccak256(["bytes"], [arch.unencryptedShard])),
//     thirdParty.address
//   );
// }

// async function _runCreateVaultTest(arg: { shares: number; threshold: number }) {
//   const vaultName = `Init vault (${arg.shares})`;
//   const {
//     signatories,
//     vaultId,
//     vaultOwner,
//     vaultOwnerFacet,
//     shards,
//     signatoryFacet,
//     thirdPartyFacet,
//   } = await createVaultFixture(arg, vaultName);

//   // check shard lengths
//   expect(shards[0].length).to.eq(shards[1].length).to.eq(146);

//   // check hashed shard lengths
//   expect(signatories[0].unencryptedShardDoubleHash.length)
//     .to.eq(signatories[0].unencryptedShardDoubleHash.length)
//     .to.eq(66);

//   return {
//     vaultId: vaultId,
//     signatories,
//     signatoryFacet,
//     vaultOwner,
//     vaultOwnerFacet,
//     thirdPartyFacet,
//   };
// }

// async function _runRewrapTest(
//   vaultId: string,
//   vaultOwner: SignerWithAddress,
//   vaultOwnerFacet: vaultOwnerFacet
// ) {
//   // Define a new resurrection time one week in the future
//   const newResurrectionTime = (await time.latest()) + time.duration.weeks(1);

//   await vaultOwnerFacet.connect(vaultOwner).rewrapVault(vaultId, newResurrectionTime);
// }

// async function _runUnwwrapTest(
//   vaultId: string,
//   signatories: TestSignatory[],
//   signatoryFacet: SignatoryFacet
// ) {
//   await time.increase(time.duration.weeks(1));

//   for await (const arch of signatories) {
//     await signatoryFacet.connect(arch.signer).unwrapVault(vaultId, arch.unencryptedShard);
//   }
// }
