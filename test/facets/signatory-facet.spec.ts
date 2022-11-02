// import "@nomiclabs/hardhat-waffle";
// import { expect } from "chai";
// import { BigNumber } from "ethers";
// import { hexlify } from "ethers/lib/utils";
// import { ethers } from "hardhat";
// import { signatoriesFixture } from "../fixtures/signatories-fixture";
// import { createVaultFixture } from "../fixtures/create-vault-fixture";
// import { finalizeTransferFixture } from "../fixtures/finalize-transfer-fixture";
// import {
//   calculateCursedBond,
//   registerSignatory,
//   sign,
//   updateSignatory,
// } from "../utils/helpers";
// import time from "../utils/time";

// describe("Contract: SignatoryFacet", () => {
//   describe("registerSignatory", () => {
//     it("registers an signatory", async () => {
//       const { signatories, signatoryFacet, viewStateFacet } = await signatoriesFixture(1);
//       const signatory = signatories[0];

//       await registerSignatory(signatory, signatoryFacet);

//       const registeredArch = await viewStateFacet.getSignatoryProfile(
//         signatory.archAddress
//       );
//       expect(registeredArch.exists).to.be.true;
//     });

//     it("fails to register an signatory when it is already registered", async () => {
//       const { signatories, signatoryFacet } = await signatoriesFixture(1);

//       const signatory = signatories[0];

//       await registerSignatory(signatory, signatoryFacet);

//       await expect(registerSignatory(signatory, signatoryFacet)).to.be.revertedWith(
//         "SignatoryProfileExistsShouldBe"
//       );
//     });

//     it("initializes the cursedBond to 0", async () => {
//       const { signatories, signatoryFacet, viewStateFacet } = await signatoriesFixture(1);
//       const signatory = signatories[0];

//       await registerSignatory(signatory, signatoryFacet);

//       const registeredArch = await viewStateFacet.getSignatoryProfile(
//         signatory.archAddress
//       );
//       expect(registeredArch.cursedBond).to.equal(BigNumber.from("0"));
//     });

//     it("initializes the profile config values correctly", async () => {
//       const { signatories, signatoryFacet, viewStateFacet } = await signatoriesFixture(1);
//       const signatory = signatories[0];

//       const minDiggingFee = "40";
//       const maxRewrapInterval = "50";
//       const freeBond = "90";
//       const peerId = "myNewPeerId";

//       await registerSignatory(
//         signatory,
//         signatoryFacet,
//         minDiggingFee,
//         maxRewrapInterval,
//         freeBond,
//         peerId
//       );

//       const registeredArch = await viewStateFacet.getSignatoryProfile(
//         signatory.archAddress
//       );
//       expect(registeredArch.minimumDiggingFee).to.equal(BigNumber.from(minDiggingFee));
//       expect(registeredArch.maximumRewrapInterval).to.equal(BigNumber.from(maxRewrapInterval));
//       expect(registeredArch.freeBond).to.equal(BigNumber.from(freeBond));
//       expect(registeredArch.peerId).to.equal(peerId);
//     });

//     it("adds the signatory address to the signatoryProfileAddresses array", async () => {
//       const { signatories, signatoryFacet, viewStateFacet } = await signatoriesFixture(1);
//       const signatory = signatories[0];

//       await registerSignatory(signatory, signatoryFacet);

//       const registeredArchAddress = await viewStateFacet.getSignatoryProfileAddressAtIndex(0);
//       expect(registeredArchAddress).to.equal(signatory.archAddress);
//     });

//     it("deposits free bond to the vault contract when registering with a positive free bond value", async () => {
//       const { signatories, signatoryFacet, vaultToken } = await signatoriesFixture(1);
//       const signatory = signatories[0];

//       const minDiggingFee = "40";
//       const maxRewrapInterval = "50";
//       const freeBond = "90";

//       // hopefully someday chai will support to.be.changed.by matchers for contracts/bignums
//       const vaultContractBalanceBefore = await vaultToken.balanceOf(signatoryFacet.address);

//       await registerSignatory(
//         signatory,
//         signatoryFacet,
//         minDiggingFee,
//         maxRewrapInterval,
//         freeBond
//       );

//       const vaultContractBalanceAfter = await vaultToken.balanceOf(signatoryFacet.address);

//       expect(vaultContractBalanceAfter.sub(vaultContractBalanceBefore)).to.equal(
//         BigNumber.from(freeBond)
//       );
//     });
//   });

//   describe("updateSignatory", () => {
//     it("updates an signatory values successfully", async () => {
//       const { signatories, signatoryFacet, viewStateFacet } = await signatoriesFixture(1);
//       const signatory = signatories[0];

//       await registerSignatory(signatory, signatoryFacet);

//       const minDiggingFee = "150";
//       const maxRewrapInterval = "150";
//       const freeBond = "150";
//       const peerId = "12D3KooWNFXTC6pWrZpLaeVpF4r3siBk8RPV5fDcMm9kdFUsxRo5";

//       const archFreeBondBeforeUpdate = await viewStateFacet.getFreeBond(signatory.archAddress);

//       await updateSignatory(
//         signatory,
//         signatoryFacet,
//         minDiggingFee,
//         maxRewrapInterval,
//         freeBond,
//         peerId
//       );

//       const registeredArch = await viewStateFacet.getSignatoryProfile(
//         signatory.archAddress
//       );
//       expect(registeredArch.minimumDiggingFee).to.equal(BigNumber.from(minDiggingFee));
//       expect(registeredArch.maximumRewrapInterval).to.equal(BigNumber.from(maxRewrapInterval));
//       expect(registeredArch.freeBond.sub(archFreeBondBeforeUpdate)).to.equal(
//         BigNumber.from(freeBond)
//       );
//       expect(registeredArch.peerId).to.equal(peerId);
//     });

//     it("deposits free bond to the vault contract when updating with a positive free bond value", async () => {
//       const { signatories, signatoryFacet, vaultToken } = await signatoriesFixture(1);
//       const signatory = signatories[0];

//       const minDiggingFee = "40";
//       const maxRewrapInterval = "50";
//       const freeBond = "90";

//       await registerSignatory(
//         signatory,
//         signatoryFacet,
//         minDiggingFee,
//         maxRewrapInterval,
//         freeBond
//       );

//       const vaultContractBalanceBefore = await vaultToken.balanceOf(signatoryFacet.address);

//       await updateSignatory(
//         signatory,
//         signatoryFacet,
//         minDiggingFee,
//         maxRewrapInterval,
//         freeBond
//       );

//       const vaultContractBalanceAfter = await vaultToken.balanceOf(signatoryFacet.address);

//       expect(vaultContractBalanceAfter.sub(vaultContractBalanceBefore)).to.equal(
//         BigNumber.from(freeBond)
//       );
//     });

//     it("reverts when an signatory is not registered", async () => {
//       const { signatories, signatoryFacet } = await signatoriesFixture(1);
//       const signatory = signatories[0];

//       await expect(
//         updateSignatory(signatory, signatoryFacet, "150", "150", "150")
//       ).to.be.revertedWith("SignatoryProfileExistsShouldBe");
//     });
//   });

//   describe("depositFreeBond()", () => {
//     context("with an unregistered signatory", () => {
//       it("reverts when depositing free bond", async () => {
//         const { signatories, signatoryFacet } = await signatoriesFixture(1);
//         const signatory = signatories[0];

//         await expect(
//           signatoryFacet.connect(signatory.signer).depositFreeBond(BigNumber.from(100))
//         ).to.be.revertedWith("SignatoryProfileExistsShouldBe");
//       });
//     });

//     context("with a registered signatory", () => {
//       it("deposits free bond to the contract", async () => {
//         // Setup signatory + register
//         const { signatories, signatoryFacet, viewStateFacet, vaultToken } =
//           await signatoriesFixture(1);

//         const signatory = signatories[0];
//         await registerSignatory(signatory, signatoryFacet);

//         const amountToDeposit = "100";
//         const signatoryVaultBalanceBefore = await vaultToken.balanceOf(
//           signatory.archAddress
//         );

//         await signatoryFacet
//           .connect(signatory.signer)
//           .depositFreeBond(BigNumber.from(amountToDeposit));

//         const freeBond = await viewStateFacet.getFreeBond(signatory.archAddress);
//         expect(freeBond.toString()).to.equal(amountToDeposit);

//         const signatoryVaultBalanceAfter = await vaultToken.balanceOf(
//           signatory.archAddress
//         );

//         expect(
//           signatoryVaultBalanceAfter.add(BigNumber.from(amountToDeposit)).toString()
//         ).to.equal(signatoryVaultBalanceBefore.toString());

//         const contractSarcBalance = await vaultToken.balanceOf(signatoryFacet.address);
//         expect(contractSarcBalance.toString()).to.equal(amountToDeposit);
//       });

//       it("emits event DepositFreeBond()", async () => {
//         const { signatories, signatoryFacet } = await signatoriesFixture(1);
//         const signatory = signatories[0];

//         await registerSignatory(signatory, signatoryFacet);

//         const tx = signatoryFacet
//           .connect(signatory.signer)
//           .depositFreeBond(BigNumber.from(100));

//         await expect(tx)
//           .emit(signatoryFacet, "DepositFreeBond")
//           .withArgs(signatory.archAddress, 100);
//       });
//     });

//     it("reverts if deposit amount is negative", async () => {
//       const { signatories, signatoryFacet } = await signatoriesFixture(1);

//       // Try to deposit a negative amount
//       await expect(
//         signatoryFacet.connect(signatories[0].signer).depositFreeBond(BigNumber.from(-1))
//       ).to.be.reverted;
//     });
//   });

//   describe("withdrawFreeBond()", () => {
//     context("with an unregistered signatory", () => {
//       it("reverts when withdrawing free bond", async () => {
//         const { signatories, signatoryFacet } = await signatoriesFixture(1);
//         const signatory = signatories[0];

//         await expect(
//           signatoryFacet.connect(signatory.signer).withdrawFreeBond(BigNumber.from(100))
//         ).to.be.reverted;
//       });
//     });

//     context("with a registered signatory with positive free bond deposit", () => {
//       context("Successful withdrawals", () => {
//         it("withdraws free bond from the contract", async () => {
//           const { signatories, signatoryFacet, viewStateFacet, vaultToken } =
//             await signatoriesFixture(1);
//           const contextSignatory = signatories[0];
//           await registerSignatory(contextSignatory, signatoryFacet);

//           const archBalanceBefore = await vaultToken.balanceOf(contextSignatory.archAddress);

//           // Put some free bond on the contract so we can withdraw it
//           await signatoryFacet
//             .connect(contextSignatory.signer)
//             .depositFreeBond(BigNumber.from(100));

//           // Withdraw free bond
//           await signatoryFacet
//             .connect(contextSignatory.signer)
//             .withdrawFreeBond(BigNumber.from(100));

//           const freeBond = await viewStateFacet.getFreeBond(contextSignatory.archAddress);
//           expect(freeBond.toString()).to.equal("0");

//           const archBalanceAfter = await vaultToken.balanceOf(contextSignatory.archAddress);

//           expect(archBalanceAfter.toString()).to.equal(archBalanceBefore.toString());

//           const contractSarcBalance = await vaultToken.balanceOf(signatoryFacet.address);
//           expect(contractSarcBalance.toString()).to.equal("0");
//         });

//         it("should emit an event when the free bond is withdrawn", async () => {
//           const { signatories, signatoryFacet } = await signatoriesFixture(1);
//           const contextSignatory = signatories[0];
//           await registerSignatory(contextSignatory, signatoryFacet);

//           // Put some free bond on the contract so we can withdraw it
//           await signatoryFacet
//             .connect(contextSignatory.signer)
//             .depositFreeBond(BigNumber.from(100));

//           const tx = signatoryFacet
//             .connect(contextSignatory.signer)
//             .withdrawFreeBond(BigNumber.from(100));

//           await expect(tx)
//             .to.emit(signatoryFacet, "WithdrawFreeBond")
//             .withArgs(contextSignatory.archAddress, 100);
//         });

//         it("should emit a transfer event when the vault token is transfered", async () => {
//           const { signatories, signatoryFacet, vaultToken } = await signatoriesFixture(1);
//           const contextSignatory = signatories[0];
//           await registerSignatory(contextSignatory, signatoryFacet);

//           // Put some free bond on the contract so we can withdraw it
//           await signatoryFacet
//             .connect(contextSignatory.signer)
//             .depositFreeBond(BigNumber.from(100));

//           // Withdraw free bond
//           const tx = await signatoryFacet
//             .connect(contextSignatory.signer)
//             .withdrawFreeBond(BigNumber.from(100));
//           await expect(tx).emit(vaultToken, "Transfer");
//         });
//       });

//       context("Failed withdrawals", () => {
//         it("reverts if amount is negative", async () => {
//           const { signatories, signatoryFacet } = await signatoriesFixture(1);
//           const contextSignatory = signatories[0];
//           await registerSignatory(contextSignatory, signatoryFacet);

//           // Put some free bond on the contract so we can withdraw it
//           await signatoryFacet
//             .connect(contextSignatory.signer)
//             .depositFreeBond(BigNumber.from(100));

//           // Try to withdraw a negative amount
//           await expect(signatoryFacet.withdrawFreeBond(BigNumber.from(-1))).to.be.reverted;
//         });

//         it("reverts on attempt to withdraw more than free bond", async () => {
//           const { signatories, signatoryFacet } = await signatoriesFixture(1);
//           const contextSignatory = signatories[0];
//           await registerSignatory(contextSignatory, signatoryFacet);

//           // Put some free bond on the contract so we can withdraw it
//           await signatoryFacet
//             .connect(contextSignatory.signer)
//             .depositFreeBond(BigNumber.from(100));

//           // Try to withdraw with a non-signatory address
//           await expect(
//             signatoryFacet
//               .connect(contextSignatory.signer)
//               .withdrawFreeBond(BigNumber.from(101))
//           ).to.be.revertedWith("NotEnoughFreeBond");
//         });
//       });
//     });
//   });

//   describe("withdrawReward()", () => {
//     it("withdraws all the signatories rewards", async () => {
//       const shares = 5;
//       const threshold = 2;

//       const archDiggingFee = BigNumber.from("1000000000000");

//       // Setup arch + unwrap so rewards are received
//       const {
//         signatories,
//         signatoryFacet,
//         vaultId,
//         vaultToken,
//         viewStateFacet,
//         resurrectionTime,
//       } = await createVaultFixture(
//         { shares, threshold, archMinDiggingFee: archDiggingFee },
//         "Test Vault"
//       );

//       const contextSignatory = signatories[0];

//       await time.increaseTo(resurrectionTime);

//       await signatoryFacet
//         .connect(contextSignatory.signer)
//         .unwrapVault(vaultId, contextSignatory.unencryptedShard);

//       // expect rewards to be increased after unwrap (this should probably be in a separate test)
//       const currentRewards = await viewStateFacet.getRewards(contextSignatory.archAddress);
//       expect(currentRewards).to.equal(archDiggingFee);

//       const archVaultBalanceBefore = await vaultToken.balanceOf(contextSignatory.archAddress);

//       await signatoryFacet.connect(contextSignatory.signer).withdrawReward();

//       // expect rewards to be depleted after claiming
//       const rewardsAfterWithdrawal = await viewStateFacet.getRewards(
//         contextSignatory.archAddress
//       );
//       expect(rewardsAfterWithdrawal).to.equal(0);

//       // expect archs vault token balance to increase by rewards amount
//       expect(await vaultToken.balanceOf(contextSignatory.archAddress)).to.equal(
//         archVaultBalanceBefore.add(archDiggingFee)
//       );
//     });
//   });

//   describe("unwrapVault()", () => {
//     const shares = 5;
//     const threshold = 2;

//     context("Successful unwrap", () => {
//       it("should store the unencrypted shard on the contract", async () => {
//         const { signatories, signatoryFacet, vaultId, viewStateFacet, resurrectionTime } =
//           await createVaultFixture({ shares, threshold }, "Test Vault");

//         // Set the evm timestamp of the next block to be 1 week and 1 second in
//         // the future
//         await time.increaseTo(resurrectionTime);

//         // Have signatory unwrap
//         await signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(vaultId, signatories[0].unencryptedShard);

//         // Check that the unencrypted shard is stored on the contract
//         const signatory = await viewStateFacet.getVaultSignatory(
//           vaultId,
//           signatories[0].archAddress
//         );

//         expect(signatory.unencryptedShard).to.equal(
//           hexlify(signatories[0].unencryptedShard)
//         );
//       });

//       it("should free up the signatory's cursed bond", async () => {
//         const { signatories, signatoryFacet, vaultId, viewStateFacet, resurrectionTime } =
//           await createVaultFixture({ shares, threshold }, "Test Vault");

//         // Get the cursed bond amount of the first signatory before initialize
//         const cursedBondAmountBefore = await viewStateFacet.getCursedBond(
//           signatories[0].archAddress
//         );

//         await time.increaseTo(resurrectionTime);

//         // Have signatory unwrap
//         await signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(vaultId, signatories[0].unencryptedShard);

//         // Get the cursed bond amount of the first signatory after unwrapping
//         const cursedBondAmountAfter = await viewStateFacet.getCursedBond(
//           signatories[0].archAddress
//         );

//         // Check that the cursed bond amount has been freed up.
//         expect(cursedBondAmountBefore).to.equal(calculateCursedBond(signatories[0].diggingFee));
//         expect(cursedBondAmountAfter).to.equal(0);
//       });

//       it("should add this vault to the signatory's successful vaultphagi", async () => {
//         const { signatories, signatoryFacet, vaultId, viewStateFacet, resurrectionTime } =
//           await createVaultFixture({ shares, threshold }, "Test Vault");

//         await time.increaseTo(resurrectionTime);

//         // Have signatory unwrap
//         await signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(vaultId, signatories[0].unencryptedShard);

//         const isSuccessfulVault = await viewStateFacet.getSignatorySuccessOnVault(
//           signatories[0].archAddress,
//           vaultId
//         );

//         expect(isSuccessfulVault).to.be.true;
//       });

//       it("should transfer the digging fee to the signatory's reward pool without transferring tokens", async () => {
//         const {
//           signatories,
//           signatoryFacet,
//           vaultId,
//           vaultToken,
//           viewStateFacet,
//           resurrectionTime,
//         } = await createVaultFixture({ shares, threshold }, "Test Vault");

//         // Calculate the digging fee for the first signatory
//         const totalFees = signatories[0].diggingFee;

//         // Get the vault balance of the first signatory before unwrap
//         const vaultBalanceBefore = await vaultToken.balanceOf(signatories[0].archAddress);
//         const archRewardsBefore = await viewStateFacet.getRewards(signatories[0].archAddress);

//         await time.increaseTo(resurrectionTime);

//         // Have signatory unwrap
//         await signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(vaultId, signatories[0].unencryptedShard);

//         // Get the vault balance of the first signatory after unwrap
//         const vaultBalanceAfter = await vaultToken.balanceOf(signatories[0].archAddress);
//         const archRewardsAfter = await viewStateFacet.getRewards(signatories[0].archAddress);

//         // Check that the difference between the before and after rewards is
//         // equal to the total fees, and actual token balance is unchanged
//         expect(vaultBalanceAfter.toString()).to.equal(vaultBalanceBefore.toString());
//         expect(archRewardsAfter.toString()).to.equal(archRewardsBefore.add(totalFees).toString());
//       });

//       it("should emit UnwrapVault()", async () => {
//         const { signatories, signatoryFacet, vaultId, resurrectionTime } =
//           await createVaultFixture({ shares, threshold }, "Test Vault");

//         await time.increaseTo(resurrectionTime);

//         // Have signatory unwrap
//         const tx = signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(vaultId, signatories[0].unencryptedShard);

//         // Check that the list of events includes an event that has an address
//         // matching the vaultOwnerFacet address
//         await expect(tx).emit(signatoryFacet, "UnwrapVault");
//       });
//     });

//     context("Failed unwrap", () => {
//       it("should revert if the vault does not exist", async () => {
//         const { signatories, signatoryFacet, resurrectionTime } = await createVaultFixture(
//           { shares, threshold },
//           "Test Vault"
//         );

//         const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

//         await time.increaseTo(resurrectionTime);

//         // Have signatory unwrap
//         const tx = signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(falseIdentifier, signatories[0].unencryptedShard);

//         await expect(tx).to.be.revertedWith("VaultDoesNotExist");
//       });

//       it("should revert if the sender is not an signatory on this vault", async () => {
//         const { signatories, signatoryFacet, vaultId, recipient, resurrectionTime } =
//           await createVaultFixture({ shares, threshold }, "Test Vault");

//         await time.increaseTo(resurrectionTime);

//         // Have signatory unwrap
//         const tx = signatoryFacet
//           .connect(recipient)
//           .unwrapVault(vaultId, signatories[0].unencryptedShard);

//         await expect(tx).to.be.revertedWith("SignatoryNotOnVault");
//       });

//       it("should revert if unwrap is called before the resurrection time has passed", async () => {
//         const { signatories, signatoryFacet, vaultId } = await createVaultFixture(
//           { shares, threshold },
//           "Test Vault"
//         );

//         // Have signatory unwrap
//         const tx = signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(vaultId, signatories[0].unencryptedShard);

//         await expect(tx).to.be.revertedWith("TooEarlyToUnwrap");
//       });

//       it("should revert if unwrap is called after the grace period has elapsed", async () => {
//         const { signatories, signatoryFacet, vaultId, resurrectionTime, viewStateFacet } =
//           await createVaultFixture({ shares, threshold }, "Test Vault");

//         // increase time beyond resurrection time + grace period to expire vault
//         const gracePeriod = await viewStateFacet.getGracePeriod();
//         await time.increaseTo(resurrectionTime + +gracePeriod + 1);

//         // Have signatory unwrap
//         const tx = signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(vaultId, signatories[0].unencryptedShard);

//         await expect(tx).to.be.revertedWith("TooLateToUnwrap");
//       });

//       it("should revert if this signatory has already unwrapped this vault", async () => {
//         const { signatories, signatoryFacet, vaultId, resurrectionTime } =
//           await createVaultFixture({ shares, threshold }, "Test Vault");

//         await time.increaseTo(resurrectionTime);

//         await signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(vaultId, signatories[0].unencryptedShard);

//         const tx = signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(vaultId, signatories[0].unencryptedShard);

//         await expect(tx).to.be.revertedWith("SignatoryAlreadyUnwrapped");
//       });

//       it("should revert if the hash of the unencrypted shard does not match the hashed shard stored on the vault", async () => {
//         const { signatories, signatoryFacet, vaultId, resurrectionTime } =
//           await createVaultFixture({ shares, threshold }, "Test Vault");

//         await time.increaseTo(resurrectionTime);

//         // Have signatory unwrap
//         const tx = signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(vaultId, Buffer.from("somethingElse"));
//         const tx2 = signatoryFacet
//           .connect(signatories[0].signer)
//           .unwrapVault(vaultId, signatories[1].unencryptedShard);

//         await expect(tx).to.be.revertedWith("UnencryptedShardHashMismatch");
//         await expect(tx2).to.be.revertedWith("UnencryptedShardHashMismatch");
//       });
//     });
//   });

//   describe("finalizeTransfer()", () => {
//     const shares = 5;
//     const threshold = 2;

//     context("Successful transfer", () => {
//       it("should update the list of signatories on a vault", async () => {
//         const { tx, oldSignatory, newSignatory, vaultId, viewStateFacet } =
//           await finalizeTransferFixture();
//         await tx;

//         const signatoryAddresses = (await viewStateFacet.getVault(vaultId))
//           .signatories;

//         expect(signatoryAddresses).to.have.lengthOf(shares);
//         expect(signatoryAddresses).to.contain(newSignatory.archAddress);
//         expect(signatoryAddresses).to.not.contain(oldSignatory.address);
//       });

//       it("should update the data in the vaultSignatorys mapping", async () => {
//         const { oldSignatory, newSignatory, vaultId, viewStateFacet } =
//           await finalizeTransferFixture();

//         // Check that new signatory has some legitimate data
//         const newSignatoryData = await viewStateFacet.getVaultSignatory(
//           vaultId,
//           newSignatory.archAddress
//         );

//         expect(newSignatoryData.unencryptedShardDoubleHash).to.not.equal(
//           ethers.constants.HashZero
//         );
//         expect(newSignatoryData.unencryptedShardDoubleHash).to.not.equal(
//           ethers.constants.HashZero
//         );
//         expect(newSignatoryData.unencryptedShardDoubleHash).to.not.equal(
//           ethers.constants.HashZero
//         );

//         // Check that the old signatory's values are reset to default values
//         const oldSignatoryData = await viewStateFacet.getVaultSignatory(
//           vaultId,
//           oldSignatory.address
//         );

//         expect(oldSignatoryData.unencryptedShardDoubleHash).to.equal(ethers.constants.HashZero);

//         expect(oldSignatoryData.unencryptedShardDoubleHash).to.equal(ethers.constants.HashZero);

//         expect(oldSignatoryData.unencryptedShardDoubleHash).to.equal(ethers.constants.HashZero);
//         expect(oldSignatoryData.diggingFee).to.equal("0");
//       });

//       it("should add the arweave transaction id to the list of arweaveTxIds on the vault", async () => {
//         const { vaultId, viewStateFacet } = await finalizeTransferFixture();

//         const arweaveTxIds = (await viewStateFacet.getVault(vaultId)).arweaveTxIds;

//         expect(arweaveTxIds).to.have.lengthOf(3);
//       });

//       it("should free the old signatories bond", async () => {
//         const {
//           bondAmount,
//           oldSignatoryFreeBondBefore,
//           oldSignatoryFreeBondAfter,
//           oldSignatoryCursedBondBefore,
//           oldSignatoryCursedBondAfter,
//         } = await finalizeTransferFixture();

//         // Check that the difference betwwen the old and new cursed bonds is equal to
//         // the bond amount
//         expect(oldSignatoryCursedBondBefore.sub(oldSignatoryCursedBondAfter)).to.equal(
//           bondAmount.toString()
//         );

//         // Check that the difference betwwen the old and new free bonds is equal to
//         // the bond amount
//         expect(oldSignatoryFreeBondAfter.sub(oldSignatoryFreeBondBefore)).to.equal(
//           bondAmount.toString()
//         );
//       });

//       it("should curse the new signatories bond", async () => {
//         const {
//           newSignatoryCursedBondBefore,
//           newSignatoryCursedBondAfter,
//           newSignatoryFreeBondBefore,
//           newSignatoryFreeBondAfter,
//           bondAmount,
//         } = await finalizeTransferFixture();

//         // Check that the difference betwwen the old and new cursed bonds is equal to
//         // the bond amount
//         expect(newSignatoryCursedBondAfter.sub(newSignatoryCursedBondBefore)).to.equal(
//           bondAmount.toString()
//         );

//         // Check that the difference betwwen the new and new free bonds is equal to
//         // the bond amount
//         expect(newSignatoryFreeBondBefore.sub(newSignatoryFreeBondAfter)).to.equal(
//           bondAmount.toString()
//         );
//       });

//       it("should emit FinalizeTransfer()", async () => {
//         const {
//           tx,
//           signatoryFacet,
//           oldSignatory,
//           newSignatory,
//           vaultId,
//           arweaveTxIds,
//           viewStateFacet,
//         } = await finalizeTransferFixture();

//         await expect(tx)
//           .emit(signatoryFacet, "FinalizeTransfer")
//           .withArgs(
//             vaultId,
//             arweaveTxIds[1],
//             oldSignatory.address,
//             newSignatory.archAddress,
//           );
//       });
//     });

//     context("Failed transfer", () => {
//       it("should revert if the vault does not exist", async () => {
//         const { signatories, signatoryFacet, arweaveTxIds } = await createVaultFixture(
//           { shares, threshold },
//           "Test Vault"
//         );

//         const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

//         const unnamedSigners = await ethers.getUnnamedSigners();
//         const newSignatory = unnamedSigners[unnamedSigners.length - signatories.length - 1];

//         const oldSignatory = signatories[1].signer;
//         const oldSignatorySignature = await sign(oldSignatory, arweaveTxIds[1], "string");

//         const tx = signatoryFacet
//           .connect(newSignatory)
//           .finalizeTransfer(falseIdentifier, arweaveTxIds[1], oldSignatorySignature);

//         await expect(tx).to.be.revertedWith("VaultDoesNotExist");
//       });

//       it("should revert if the resurrection time has passed", async () => {
//         const { signatories, signatoryFacet, vaultId, arweaveTxIds, resurrectionTime } =
//           await createVaultFixture({ shares, threshold }, "Test Vault");

//         const unnamedSigners = await ethers.getUnnamedSigners();
//         const newSignatory = unnamedSigners[unnamedSigners.length - signatories.length - 1];

//         const oldSignatory = signatories[1].signer;
//         const oldSignatorySignature = await sign(oldSignatory, arweaveTxIds[1], "string");

//         await time.increaseTo(resurrectionTime + 1);

//         const tx = signatoryFacet
//           .connect(newSignatory)
//           .finalizeTransfer(vaultId, arweaveTxIds[1], oldSignatorySignature);

//         await expect(tx).to.be.revertedWith("ResurrectionTimeInPast");
//       });

//       it("should revert if the provided signature is not from an signatory on the vault", async () => {
//         const { signatories, signatoryFacet, vaultId, arweaveTxIds } =
//           await createVaultFixture({ shares, threshold }, "Test Vault");

//         const unnamedSigners = await ethers.getUnnamedSigners();
//         const newSignatory = unnamedSigners[unnamedSigners.length - signatories.length - 1];

//         const oldSignatorySignature = await sign(unnamedSigners[10], arweaveTxIds[1], "string");

//         const tx = signatoryFacet
//           .connect(newSignatory)
//           .finalizeTransfer(vaultId, arweaveTxIds[1], oldSignatorySignature);

//         await expect(tx).to.be.revertedWith("SignerNotSignatoryOnVault");
//       });

//       it("should revert if the provided signature is not a signature of the arweave transaction id", async () => {
//         const { signatories, signatoryFacet, vaultId, arweaveTxIds } =
//           await createVaultFixture({ shares, threshold }, "Test Vault");

//         const unnamedSigners = await ethers.getUnnamedSigners();
//         const newSignatory = unnamedSigners[unnamedSigners.length - signatories.length - 1];

//         const oldSignatory = signatories[1].signer;

//         const fakeArweaveTxId =
//           "somethingelsethatisnotthearweavetxidliksomerandomstringlikethisoneitcouldbedogbreedsorcarnameslikeschnauzerorporsche";

//         const oldSignatorySignature = await sign(oldSignatory, fakeArweaveTxId, "string");

//         const tx = signatoryFacet
//           .connect(newSignatory)
//           .finalizeTransfer(vaultId, arweaveTxIds[1], oldSignatorySignature);

//         await expect(tx).to.be.revertedWith("SignerNotSignatoryOnVault");
//       });
//     });
//   });
// });
