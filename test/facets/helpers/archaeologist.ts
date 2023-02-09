import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { accountGenerator } from "./accounts";
import { fundAndApproveAccount } from "./sarcoToken";
import { getContracts } from "./contracts";
import { BigNumberish } from "ethers";

const { ethers } = require("hardhat");

/**
 * Parameters used to register test archaeologists
 * profileMinDiggingFee and profileMaxRewrapIntervalSeconds are registered on the archaeologist's profile
 * sarcoBalance - amount of SARCO to seed new archaeologist account with
 * freeBondSarco - amount of SARCO to deduct from sarcoBalance and register as free bond
 */
export interface ArchaeologistParameters {
  profileMinDiggingFeePerSecondSarquito: BigNumberish;
  profileMaxRewrapIntervalSeconds: number;
  sarcoBalance: number;
  freeBondSarco: number;
}

/**
 * Registers an archaeologist with the supplied ArchaeologistParameters
 *
 * Transfers the archaeologist the specified SARCO balance and approves diamond spending on their behalf
 *
 * Registers the archaeologist on the ArchaeologistFacet with the specified freeBond amount (deducted from their balance)
 *
 * @param archaeologistParams
 * @returns the archaeologist's signer
 */
export const registerArchaeologist = async (
  archaeologistParams: ArchaeologistParameters
): Promise<SignerWithAddress> => {
  const archaeologistFreeBondSarquitos = ethers.utils.parseEther(
    archaeologistParams.freeBondSarco.toString()
  );
  const archaeologistSigner = await accountGenerator.newAccount();
  const peerId = `peerId for ${archaeologistSigner.address}`;

  // transfer sarco to archaeologist signer and approve the diamond to spend on their behalf
  await fundAndApproveAccount(
    archaeologistSigner,
    archaeologistParams.sarcoBalance
  );

  // Register the archaeologist with the specified free bond
  await (await getContracts()).archaeologistFacet
    .connect(archaeologistSigner)
    .registerArchaeologist(
      peerId,
      archaeologistParams.profileMinDiggingFeePerSecondSarquito,
      archaeologistParams.profileMaxRewrapIntervalSeconds,
      archaeologistFreeBondSarquitos
    );

  return archaeologistSigner;
};
