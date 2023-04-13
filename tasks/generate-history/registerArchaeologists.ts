import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { generateHistoryConfig } from "./config";
import { range } from "./helpers";

/**
 * Gives an archaeologist sarco token, approves the sarco token, and registers the archaeologist.
 * Error stack traces are left out to keep the logs clean.
 * @param hre The Hardhat Runtime Environment
 */
export async function registerArchaeologists(
  hre: HardhatRuntimeEnvironment
): Promise<SignerWithAddress[]> {
  // @ts-ignore
  const { ethers } = hre;
  const accounts = await ethers.getSigners();
  const count = generateHistoryConfig.archaeologistCount;

  if (count > accounts.length) {
    throw new Error(
      `Not enough accounts. Count must be less than or equal to ${accounts.length}`
    );
  }

  // Get the contract
  const diamond = await ethers.getContract("SarcophagusGoerliV2_DiamondProxy");
  const archaeologistFacet = await ethers.getContractAt(
    "ArchaeologistFacet",
    diamond.address
  );
  const sarcoToken = await ethers.getContract("SarcoTokenMock");

  console.log("Registering archaeologists...");
  const archaeologistSigners: SignerWithAddress[] = [];
  for (let i = 0; i < count; i++) {
    const account = accounts[i];
    const minimumDiggingFee = 10;

    // 1 week
    const maximumRewrapInterval = 604800;

    // Be sure to provide plenty of free bond for the archaeologist
    const freeBond = 10000;
    const maxResurrectionTime = 1739643155; // 2 years

    // Register the archaeologist
    try {
      await sarcoToken
        .connect(account)
        .approve(diamond.address, ethers.constants.MaxUint256);
      await sarcoToken.transfer(account.address, freeBond * 10);
      await archaeologistFacet
        .connect(account)
        .registerArchaeologist(
          "some-peer-id",
          BigNumber.from(minimumDiggingFee),
          BigNumber.from(maximumRewrapInterval),
          BigNumber.from(freeBond),
          BigNumber.from(maxResurrectionTime)
        );
      console.log(
        `(${i + 1}/${count}) Registered archaeologist ${account.address}`
      );
    } catch (_error) {
      const error = _error as Error;
      console.error("Failed to register archaeologist", account.address);
      console.error(
        "If generate-history has already been run on this node it will fail. Please restart the node and try again."
      );
      throw new Error(error.message);
    }

    archaeologistSigners.push(account);
  }

  return archaeologistSigners;
}
