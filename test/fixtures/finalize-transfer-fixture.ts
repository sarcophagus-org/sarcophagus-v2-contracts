import { ethers } from "hardhat";
import { SignatoryFacet } from "../../typechain";
import { sign } from "../utils/helpers";
import { createVaultFixture } from "./create-vault-fixture";

/**
 * A fixture to set up the transfer of an signatory's R&R on a
 * vault to an unbonded signatory.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const finalizeTransferFixture = async () => {
  const {
    deployer,
    signatories,
    signatoryFacet,
    viewStateFacet,
    vaultId,
    arweaveTxIds,
    unbondedSignatories,
    diamond,
  } = await createVaultFixture({ shares: 5, threshold: 3, addUnbondedSignatories: 1 }, "Test Vault");

  const newSignatory = unbondedSignatories[0];

  const oldSignatory = signatories[1].signer;
  const oldSignatorySignature = await sign(oldSignatory, arweaveTxIds[1], "string");

  const oldSignatoryFees = {
    diggingFee: signatories[1].diggingFee,
  };

  // Calculate the old signatory's bond amount
  const bondAmount = oldSignatoryFees.diggingFee;

  // Get the signatories cursed, free bond before transfer
  const oldSignatoryCursedBondBefore = await viewStateFacet.getCursedBond(
    oldSignatory.address
  );
  const oldSignatoryFreeBondBefore = await viewStateFacet.getFreeBond(oldSignatory.address);

  const newSignatoryCursedBondBefore = await viewStateFacet.getCursedBond(
    newSignatory.signatoryAddress
  );
  const newSignatoryFreeBondBefore = await viewStateFacet.getFreeBond(
    newSignatory.signatoryAddress
  );

  // Actually have the new signatory finalize the transfer
  const tx = signatoryFacet
    .connect(newSignatory.signer)
    .finalizeTransfer(vaultId, arweaveTxIds[1], oldSignatorySignature);

  // Get the signatories cursed, free bond before transfer
  const oldSignatoryCursedBondAfter = await viewStateFacet.getCursedBond(
    oldSignatory.address
  );
  const oldSignatoryFreeBondAfter = await viewStateFacet.getFreeBond(oldSignatory.address);
  const newSignatoryCursedBondAfter = await viewStateFacet.getCursedBond(
    newSignatory.signatoryAddress
  );
  const newSignatoryFreeBondAfter = await viewStateFacet.getFreeBond(
    newSignatory.signatoryAddress
  );

  return {
    tx,
    diamond,
    deployer,
    signatoryFacet: signatoryFacet as SignatoryFacet,
    viewStateFacet,
    signatories,
    oldSignatory,
    newSignatory,
    vaultId,
    arweaveTxIds,
    oldSignatoryCursedBondBefore,
    oldSignatoryCursedBondAfter,
    oldSignatoryFreeBondBefore,
    oldSignatoryFreeBondAfter,
    newSignatoryCursedBondBefore,
    newSignatoryCursedBondAfter,
    newSignatoryFreeBondBefore,
    newSignatoryFreeBondAfter,
    bondAmount,
  };
};
