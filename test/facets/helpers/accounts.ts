import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import crypto from "crypto";

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
 * Returns the deployer account signer
 * */
export const getDeployer = async (): Promise<SignerWithAddress> =>
  await ethers.getSigner((await getNamedAccounts()).deployer);
