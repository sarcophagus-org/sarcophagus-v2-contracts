import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { deployments } from "hardhat";

export const setup = deployments.createFixture(
  async ({ deployments, getNamedAccounts, getUnnamedAccounts, ethers }) => {
    await deployments.fixture();
    const { deployer } = await getNamedAccounts();
    // set the first account from unnamed accounts as the embalmer
    const unnamedAccounts = await getUnnamedAccounts();
    const embalmer = await ethers.getSigner(unnamedAccounts[0]);
    const archaeologists = [
      await ethers.getSigner(unnamedAccounts[1]),
      await ethers.getSigner(unnamedAccounts[2]),
      await ethers.getSigner(unnamedAccounts[3]),
    ];

    const sarcoToken = await ethers.getContract("SarcoTokenMock");
    const diamond = await ethers.getContract("Diamond_DiamondProxy");

    // Set up the archaeologists

    // Approve the embalmer on the sarco token so transferFrom will work
    await sarcoToken
      .connect(embalmer)
      .approve(diamondAddress, ethers.constants.MaxUint256);
  }
);
