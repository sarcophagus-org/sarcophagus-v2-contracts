import { Contract } from "ethers";
import { ethers } from "hardhat";

/**
 * Returns all contracts
 * */
export const getContracts = async (): Promise<{
  diamond: Contract;
  sarcoToken: Contract;
  embalmerFacet: Contract;
  archaeologistFacet: Contract;
  thirdPartyFacet: Contract;
  viewStateFacet: Contract;
  adminFacet: Contract;
}> => {
  const diamond = await ethers.getContract("Diamond_DiamondProxy");

  return {
    diamond,
    sarcoToken: await ethers.getContract("SarcoTokenMock"),
    embalmerFacet: await ethers.getContractAt("EmbalmerFacet", diamond.address),
    archaeologistFacet: await ethers.getContractAt(
      "ArchaeologistFacet",
      diamond.address
    ),
    thirdPartyFacet: await ethers.getContractAt(
      "ThirdPartyFacet",
      diamond.address
    ),
    viewStateFacet: await ethers.getContractAt(
      "ViewStateFacet",
      diamond.address
    ),
    adminFacet: await ethers.getContractAt("AdminFacet", diamond.address),
  };
};
