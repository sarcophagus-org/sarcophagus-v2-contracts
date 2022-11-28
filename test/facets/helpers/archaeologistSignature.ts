import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { sign } from "../../utils/helpers";
import { doubleHashShare } from "./shamirSecretSharing";

const { ethers } = require("hardhat");

/**
 * SelectedArchaeologist to be passed into createSarcophagus
 * contains additional rawKeyShare property for convenience during testing
 * */
export interface ArchaeologistData {
  archAddress: string;
  doubleHashedKeyShare: string;
  diggingFeeSarquitos: string;
  v: number;
  r: string;
  s: string;
  rawKeyShare: Buffer;
}

/**
 * Parameters signed by an archaeologist during sarcophagus negotiation
 */
export interface SarcophagusNegotiationParams {
  arweaveTxId: string;
  rawKeyShare: Buffer;
  maximumRewrapIntervalSeconds: number;
  creationTime: number;
  diggingFeeSarco: number;
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
  // calculate sarcophagus' digging fees in sarquitos
  const sarcophagusDiggingFeeSarquitos = ethers.utils
    .parseEther(sarcophagusParams.diggingFeeSarco.toString())
    .toString();

  const doubleHashedShare = doubleHashShare(sarcophagusParams.rawKeyShare);
  // sign sarcophagus negotiation parameters with archaeologist signer
  const { v, r, s } = await sign(
    archaeologistSigner,
    [
      sarcophagusParams.arweaveTxId,
      doubleHashedShare,
      sarcophagusParams.maximumRewrapIntervalSeconds.toString(),
      sarcophagusDiggingFeeSarquitos,
      sarcophagusParams.creationTime.toString(),
    ],
    ["string", "bytes32", "uint256", "uint256", "uint256"]
  );

  return {
    archAddress: archaeologistSigner.address,
    diggingFeeSarquitos: sarcophagusDiggingFeeSarquitos,
    rawKeyShare: sarcophagusParams.rawKeyShare,
    doubleHashedKeyShare: doubleHashedShare,
    v,
    r,
    s,
  };
};
