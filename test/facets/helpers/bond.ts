import { getContracts } from "./contracts";
import { BigNumber } from "ethers";

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
 * Returns the free bond for the archaeologist
 * */
export const getArchaeologistFreeBondSarquitos = async (
  archaeologistAddress: string
): Promise<BigNumber> => {
  const { viewStateFacet } = await getContracts();
  return (await viewStateFacet.getArchaeologistProfile(archaeologistAddress))
    .freeBond;
};
