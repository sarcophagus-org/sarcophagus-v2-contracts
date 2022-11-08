// import { createVaultFixture } from "../fixtures/create-vault-fixture";
// import { BigNumber } from "ethers";
// import { expect } from "chai";

// const shares = 5;
// const threshold = 3;
// const vaultName = "test init";

// describe("AdminFacet", () => {
//   describe("setProtocolFee", () => {
//     it("allows deployer of diamond contract to set the protocol fee", async () => {
//       const {deployer, adminFacet, viewStateFacet } = await createVaultFixture(
//         { shares, threshold },
//         vaultName
//       );

//       const newProtocolFee = BigNumber.from("12");
//       await adminFacet.connect(deployer).setProtocolFeeBasePercentage(newProtocolFee);
//       const protocolFee = await viewStateFacet.connect(deployer).getProtocolFeeBasePercentage();

//       expect(newProtocolFee).to.equal(protocolFee);
//     });

//     it("reverts if non-deployer (owner) attempts to set the protocol fee", async () => {
//       const { vaultOwner, adminFacet } = await createVaultFixture({ shares, threshold }, vaultName);

//       const protocolFee = BigNumber.from("12");
//       await expect(
//         adminFacet.connect(vaultOwner).setProtocolFeeBasePercentage(protocolFee)
//       ).to.be.revertedWith("LibDiamond: Must be contract owner");
//     });
//   });
//   // describe("setGracePeriod", () => {
//   //   it("allows deployer of diamond contract to update the grace period", async () => {
//   //     const { deployer, adminFacet, viewStateFacet } = await createVaultFixture(
//   //       { shares, threshold },
//   //       vaultName
//   //     );

//   //     const newGracePeriod = BigNumber.from("7200");
//   //     await adminFacet.connect(deployer).setGracePeriod(newGracePeriod);
//   //     const gracePeriod = await viewStateFacet.connect(deployer).getGracePeriod();

//   //     expect(gracePeriod).to.equal(newGracePeriod);
//   //   });

//   //   it("reverts if non-deployer (owner) attempts to set the grace period", async () => {
//   //     const { vaultOwner, adminFacet } = await createVaultFixture({ shares, threshold }, vaultName);

//   //     const newGracePeriod = BigNumber.from("7200");
//   //     await expect(adminFacet.connect(vaultOwner).setGracePeriod(newGracePeriod)).to.be.revertedWith(
//   //       "LibDiamond: Must be contract owner"
//   //     );
//   //   });
//   // });

//   // describe("setExpirationThreshold", () => {
//   //   it("allows deployer of diamond contract to update the expirationThreshold", async () => {
//   //     const { deployer, adminFacet, viewStateFacet } = await createVaultFixture(
//   //       { shares, threshold },
//   //       vaultName
//   //     );

//   //     const newExpirationThreshold = BigNumber.from("7200");
//   //     await adminFacet.connect(deployer).setExpirationThreshold(newExpirationThreshold);
//   //     const expirationThreshold = await viewStateFacet.connect(deployer).getExpirationThreshold();

//   //     expect(expirationThreshold).to.equal(newExpirationThreshold);
//   //   });

//   //   it("reverts if non-deployer (owner) attempts to set the expirationThreshold", async () => {
//   //     const { vaultOwner, adminFacet } = await createVaultFixture({ shares, threshold }, vaultName);

//   //     const newExpirationThreshold = BigNumber.from("7200");
//   //     await expect(
//   //       adminFacet.connect(vaultOwner).setExpirationThreshold(newExpirationThreshold)
//   //     ).to.be.revertedWith("LibDiamond: Must be contract owner");
//   //   });
//   // });
// });
