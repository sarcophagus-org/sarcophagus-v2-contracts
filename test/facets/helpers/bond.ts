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
 * Returns the free bond for the archaeologist
 * */
export const getArchaeologistFreeBondSarquitos = async (
  archaeologistAddress: string
): Promise<BigNumber> => {
  const { viewStateFacet } = await getContracts();
  return (await viewStateFacet.getArchaeologistProfile(archaeologistAddress))
    .freeBond;
};

/**
 * Given an array of archaeologists, looks up all of their locked bonds and returns a Map
 * of address -> locked bond amount
 * */
export const getArchaeologistAddressesToLockedBondSarquitos = async (
  archaeologists: ArchaeologistData[]
): Promise<Map<string, BigNumber>> => {
  const { viewStateFacet } = await getContracts();
  const addressesToLockedBonds = new Map();
  (
    await viewStateFacet.getArchaeologistProfiles(
      archaeologists.map((archaeologist) => archaeologist.archAddress)
    )
  ).forEach((archaeologistProfile, index) =>
    addressesToLockedBonds.set(
      archaeologists[index].archAddress,
      archaeologistProfile.cursedBond
    )
  );
  return addressesToLockedBonds;
};

/**
 * Given an array of archaeologists, looks up all of their free bonds and returns a Map
 * of address -> free bond amount
 * */
export const getArchaeologistAddressesToFreeBondSarquitos = async (
  archaeologists: ArchaeologistData[]
): Promise<Map<string, BigNumber>> => {
  const { viewStateFacet } = await getContracts();
  const addressesToLockedBonds = new Map();
  (
    await viewStateFacet.getArchaeologistProfiles(
      archaeologists.map((archaeologist) => archaeologist.archAddress)
    )
  ).forEach((archaeologistProfile, index) =>
    addressesToLockedBonds.set(
      archaeologists[index].archAddress,
      archaeologistProfile.freeBond
    )
  );
  return addressesToLockedBonds;
};
