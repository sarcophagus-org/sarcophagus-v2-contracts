import { BigNumber } from "ethers";
import { deployments } from "hardhat";
import { getDeployedContracts } from "./get-deployed-contracts";
import { setupArchaeologists } from "./setup-archaeologists";

export const getSigners = deployments.createFixture(
  async ({ deployments, getNamedAccounts, getUnnamedAccounts, ethers }) => {
    const unnamedAccounts = await getUnnamedAccounts();
    const embalmer = await ethers.getSigner(unnamedAccounts[0]);
    const recipient = await ethers.getSigner(unnamedAccounts[1]);
    const arweaveArchaeologist = await ethers.getSigner(unnamedAccounts[2]);

    return {
      embalmer,
      recipient,
      arweaveArchaeologist,
    };
  }
);
