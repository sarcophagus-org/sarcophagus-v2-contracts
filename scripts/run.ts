import { ethers } from "hardhat";
import { ViewStateFacet } from "../typechain";
import { createSarcoScript } from "./create-sarco";

async function main() {
  // Uncomment line below to create a sarcophagus. Because createSarcoScript is adapted from createSarcoFixture,
  // it uses spawnArchaologistsWithSignatures, which assumes a fresh deploy, so will transfer tokens
  // to the same archaeologists each time it's called. Just something to keep in mind.
  //
  // const {viewStateFacet } = await createSarcoScript({ shares: 5, threshold: 3 }, "sarco 1");
  const unnamedAccounts = await ethers.getUnnamedSigners();
  const embalmer = unnamedAccounts[0];
  // const recipient = unnamedAccounts[1];
  // const thirdParty = unnamedAccounts[2];

  const diamond = await ethers.getContract("Diamond_DiamondProxy");

  const viewStateFacet = (await ethers.getContractAt(
    "ViewStateFacet",
    diamond.address
  )) as ViewStateFacet;

  const embalmerSarcophagi = await viewStateFacet.getEmbalmersarcophagi(embalmer.address);
  console.log("embalmerSarcophagi", embalmerSarcophagi);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
