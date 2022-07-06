import { deployments } from "hardhat";

export const getDeployedContracts = deployments.createFixture(
  async ({ deployments, getNamedAccounts, getUnnamedAccounts, ethers }) => {
    const diamond = await ethers.getContract("Diamond");
    const sarcoToken = await ethers.getContract("SarcoTokenMock");
    const embalmerFacet = await ethers.getContractAt(
      "EmbalmerFacet",
      diamond.address
    );
    const archaeologistFacet = await ethers.getContractAt(
      "ArchaeologistFacet",
      diamond.address
    );

    return {
      diamond,
      sarcoToken,
      embalmerFacet,
      archaeologistFacet,
    };
  }
);
