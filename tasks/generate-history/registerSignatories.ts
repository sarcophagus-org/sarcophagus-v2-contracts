import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { generateHistoryConfig } from "./config";
import { range } from "./helpers";

/**
 * Gives an signatory heritage token, approves the heritage token, and registers the signatory.
 * Error stack traces are left out to keep the logs clean.
 * @param hre The Hardhat Runtime Environment
 */
export async function registerSignatories(
  hre: HardhatRuntimeEnvironment
): Promise<SignerWithAddress[]> {
  const accounts = await hre.ethers.getSigners();
  const count = generateHistoryConfig.signatoryCount;

  if (count > accounts.length) {
    throw new Error(`Not enough accounts. Count must be less than or equal to ${accounts.length}`);
  }

  // Get the contract
  const diamond = await hre.ethers.getContract("Diamond_DiamondProxy");
  const signatoryFacet = await hre.ethers.getContractAt("SignatoryFacet", diamond.address);
  const heritageToken = await hre.ethers.getContract("HeritageTokenMock");

  console.log("Registering signatories...");
  const signatorySigners: SignerWithAddress[] = [];
  for (let i = 0; i < count; i++) {
    const account = accounts[i];
    const minimumDiggingFee = 10;

    // 1 week
    const maximumRewrapInterval = 604800;

    // Be sure to provide plenty of free bond for the signatory
    const freeBond = 10000;

    // Register the signatory
    try {
      await heritageToken.connect(account).approve(diamond.address, hre.ethers.constants.MaxUint256);
      await heritageToken.transfer(account.address, freeBond * 10);
      await signatoryFacet
        .connect(account)
        .registerSignatory(
          "some-peer-id",
          BigNumber.from(minimumDiggingFee),
          BigNumber.from(maximumRewrapInterval),
          BigNumber.from(freeBond)
        );
      console.log(`(${i + 1}/${count}) Registered signatory ${account.address}`);
    } catch (_error) {
      const error = _error as Error;
      console.error("Failed to register signatory", account.address);
      console.error(
        "If generate-history has already been run on this node it will fail. Please restart the node and try again."
      );
      throw new Error(error.message);
    }

    signatorySigners.push(account);
  }

  return signatorySigners;
}
