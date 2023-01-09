import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { ethers, getNamedAccounts, getUnnamedAccounts } = require("hardhat");

export const accountGenerator = {
  newAccount: async function (): Promise<SignerWithAddress> {
    const unnamedAccounts = await getUnnamedAccounts();
    if (!unnamedAccounts[this.index])
      throw Error(
        "Not enough test accounts. Increase value in hardhat config."
      );
    return await ethers.getSigner(unnamedAccounts[this.index++]);
  },
  index: 0,
};

/**
 * Returns the deployer account signer
 * */
export const getDeployer = async (): Promise<SignerWithAddress> =>
  await ethers.getSigner((await getNamedAccounts()).deployer);
