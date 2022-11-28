import { getContracts } from "./contracts";
import { BigNumber } from "ethers";
import { ArchaeologistData } from "./archaeologistSignature";

/**
 * Returns the locked bond for the archaeologist
 * */
export const getArchaeologistLockedBondSarquitos = async (
  archaeologistAddress: string
): Promise<BigNumber> => {
  const { viewStateFacet } = await getContracts();
  return (await viewStateFacet.getArchaeologistProfile(archaeologistAddress))
    .cursedBond;
};

/**
 * Calculates the total digging fees for a set of archaeologists
 * */
export const getTotalDiggingFeesSarquitos = (
  archaeologists: ArchaeologistData[]
): BigNumber =>
  archaeologists.reduce(
    (sum: BigNumber, archaeologist: ArchaeologistData) =>
      sum.add(BigNumber.from(archaeologist.diggingFeeSarquitos)),
    BigNumber.from(0)
  );

/**
 * Calculates the total digging fees for a set of archaeologists plus the protocol fees (incurred on rewrap and create)
 * */
export const getDiggingFeesPlusProtocolFeesSarquitos = async (
  archaeologists: ArchaeologistData[]
): Promise<BigNumber> => {
  const { viewStateFacet } = await getContracts();
  const totalDiggingFees = getTotalDiggingFeesSarquitos(archaeologists);
  return totalDiggingFees.add(
    totalDiggingFees
      .mul(await viewStateFacet.getProtocolFeeBasePercentage())
      .div(100)
  );
};
