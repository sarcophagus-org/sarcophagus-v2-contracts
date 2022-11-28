import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getContracts } from "./contracts";
import { BigNumber } from "ethers";

const { ethers, getNamedAccounts, getUnnamedAccounts } = require("hardhat");

/**
 * Returns a signer for an account that has never been used
 *
 * total number of accounts is set in hardhat config at networks.hardha.accounts.count
 * */
export const getFreshAccount = (() => {
  // track unused account index
  let index = 0;
  return async (): Promise<SignerWithAddress> => {
    const unnamedAccounts = await getUnnamedAccounts();
    if (!unnamedAccounts[index])
      throw Error(
        "Not enough test accounts. Increase value in hardhat config."
      );
    return await ethers.getSigner(unnamedAccounts[index++]);
  };
})();

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
