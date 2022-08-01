import { ethers } from "hardhat";
import { ArchaeologistFacet } from "../../typechain";
import { sign } from "../utils/helpers";
import { createSarcoFixture } from "./create-sarco-fixture";

/**
 * A fixture to set up the transfer of an archaeologist's R&R on a
 * sarcophagus to an unbonded archaeologist.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const finalizeTransferFixture = async () => {
  const {
    deployer,
    archaeologists,
    archaeologistFacet,
    viewStateFacet,
    sarcoId,
    arweaveTxId,
    unbondedArchaeologists,
    diamond,
    curses,
  } = await createSarcoFixture({ shares: 5, threshold: 3, addUnbondedArchs: 1 }, "Test Sarco");

  const newArchaeologist = unbondedArchaeologists[0];

  const oldArchaeologist = archaeologists[1].signer;
  const oldArchaeologistSignature = await sign(oldArchaeologist, arweaveTxId, "string");

  const oldArchaeologistFees = {
    diggingFee: archaeologists[1].diggingFee,
    bounty: archaeologists[1].bounty,
  };

  // Calculate the old arch's bond amount
  const bondAmount = oldArchaeologistFees.bounty.add(oldArchaeologistFees.diggingFee);

  // Get the archaeologists cursed, free bond before transfer
  const oldArchaeologistCursedBondBefore = await viewStateFacet.getCursedBond(
    oldArchaeologist.address
  );
  const oldArchaeologistFreeBondBefore = await viewStateFacet.getFreeBond(oldArchaeologist.address);

  const newArchaeologistCursedBondBefore = await viewStateFacet.getCursedBond(
    newArchaeologist.archAddress
  );
  const newArchaeologistFreeBondBefore = await viewStateFacet.getFreeBond(
    newArchaeologist.archAddress
  );

  // Transfer ownership of the curses ERC1155 contract to the diamond
  const cursesOwnerAddress = await curses.owner();
  const cursesOwnerSigner = await ethers.getSigner(cursesOwnerAddress);
  await curses.connect(cursesOwnerSigner).transferOwnership(diamond.address);

  // Actually have the new archaeologist finalize the transfer
  const tx = archaeologistFacet
    .connect(newArchaeologist.signer)
    .finalizeTransfer(sarcoId, arweaveTxId, oldArchaeologistSignature);

  // Get the archaeologists cursed, free bond before transfer
  const oldArchaeologistCursedBondAfter = await viewStateFacet.getCursedBond(
    oldArchaeologist.address
  );
  const oldArchaeologistFreeBondAfter = await viewStateFacet.getFreeBond(oldArchaeologist.address);
  const newArchaeologistCursedBondAfter = await viewStateFacet.getCursedBond(
    newArchaeologist.archAddress
  );
  const newArchaeologistFreeBondAfter = await viewStateFacet.getFreeBond(
    newArchaeologist.archAddress
  );

  return {
    tx,
    diamond,
    deployer,
    archaeologistFacet: archaeologistFacet as ArchaeologistFacet,
    viewStateFacet,
    archaeologists,
    oldArchaeologist,
    newArchaeologist,
    sarcoId,
    arweaveTxId,
    oldArchaeologistCursedBondBefore,
    oldArchaeologistCursedBondAfter,
    oldArchaeologistFreeBondBefore,
    oldArchaeologistFreeBondAfter,
    newArchaeologistCursedBondBefore,
    newArchaeologistCursedBondAfter,
    newArchaeologistFreeBondBefore,
    newArchaeologistFreeBondAfter,
    bondAmount,
    curses,
  };
};
