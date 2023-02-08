import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish } from "ethers";
import { sign } from "../../utils/helpers";

const { ethers } = require("hardhat");

/**
 * SelectedArchaeologist to be passed into createSarcophagus
 * contains additional rawKeyShare property for convenience during testing
 * */
export interface ArchaeologistData {
  archAddress: string;
  publicKey: string;
  privateKey: string;
  diggingFeePerSecondSarquito: BigNumberish;
  v: number;
  r: string;
  s: string;
}

/**
 * Parameters signed by an archaeologist during sarcophagus negotiation
 */
export interface SarcophagusNegotiationParams {
  publicKey: string;
  privateKey: string;
  maximumRewrapIntervalSeconds: number;
  creationTime: number;
  diggingFeePerSecondSarquito: BigNumberish;
}

/**
 * Creates a signature from the archaeologist's signer on the supplied SarcophagusNegotiationParams
 *
 * @param archaeologistSigner
 * @param sarcophagusParams
 * @returns ArchaeologistData with signature, arch address, and digging fee allocated to the archaeologist on the sarcophagus
 */
export const createArchSignature = async (
  archaeologistSigner: SignerWithAddress,
  sarcophagusParams: SarcophagusNegotiationParams
): Promise<ArchaeologistData> => {
  // sign sarcophagus negotiation parameters with archaeologist signer
  const { v, r, s } = await sign(
    archaeologistSigner,
    [
      sarcophagusParams.publicKey,
      sarcophagusParams.maximumRewrapIntervalSeconds.toString(),
      sarcophagusParams.diggingFeePerSecondSarquito.toString(),
      sarcophagusParams.creationTime.toString(),
    ],
    ["bytes", "uint256", "uint256", "uint256"]
  );

  return {
    archAddress: archaeologistSigner.address,
    diggingFeePerSecondSarquito: sarcophagusParams.diggingFeePerSecondSarquito,
    publicKey: sarcophagusParams.publicKey,
    privateKey: sarcophagusParams.privateKey,
    v,
    r,
    s,
  };
};
