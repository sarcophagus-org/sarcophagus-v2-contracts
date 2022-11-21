import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { sign } from "../../utils/helpers";
import { getFreshAccount } from "./accounts";
import { fundAndApproveAccount } from "./sarcoToken";
import { getContracts } from "./contracts";
import { doubleHashShare } from "./shamirSecretSharing";

export interface ArchaeologistParameters {
  minDiggingFeeSarco: number;
  maximumRewrapIntervalSeconds: number;
  // SARCO amount to seed the new archaeologist account with
  sarcoBalance: number;
  // SARCO amount to take from the archaeologist balance and register as free bond
  freeBondSarco: number;
}

/**
 * creates and registers an archaeologist with the supplied ArchaeologistParameters
 *    transfers the archaeologist the specified SARCO balance and approves diamond spending on their behalf
 *    registers the archaeologist on the ArchaeologistFacet with the specified freeBond amount
 *
 * Returns the archaeologist signer
 * */
export const createAndRegisterArchaeologist = async (
  archaeologistParams: ArchaeologistParameters
): Promise<SignerWithAddress> => {
  // calculate archaeologist's minimum digging fee and free bond in sarquitos
  const archMinDiggingFeeSarquitos = ethers.utils
    .parseEther(archaeologistParams.minDiggingFeeSarco.toString())
    .toString();
  const archaeologistFreeBondSarquitos = ethers.utils.parseEther(
    archaeologistParams.freeBondSarco.toString()
  );
  const archaeologistSigner = await getFreshAccount();
  const peerId = `peerId for ${archaeologistSigner.address}`;

  // transfer 10k sarco to archaeologist signer and approve the diamond to spend on their behalf
  await fundAndApproveAccount(
    archaeologistSigner,
    archaeologistParams.sarcoBalance
  );

  // Register the archaeologist with the specified free bond
  await (await getContracts()).archaeologistFacet
    .connect(archaeologistSigner)
    .registerArchaeologist(
      peerId,
      archMinDiggingFeeSarquitos,
      archaeologistParams.maximumRewrapIntervalSeconds,
      archaeologistFreeBondSarquitos
    );

  return archaeologistSigner;
};

export interface SarcophagusNegotiationParams {
  arweaveTxId: string;
  share: Buffer;
  maximumRewrapIntervalSeconds: number;
  timestampSeconds: number;
  diggingFeeSarco: number;
}

export interface ArchaeologistData {
  archAddress: string;
  share: Buffer;
  unencryptedShardDoubleHash: string;
  diggingFee: string;
  v: number;
  r: string;
  s: string;
}

/**
 * Generates a signature from the archaeologist's signer on the supplied SarcophagusNegotiationParams
 *
 * Returns ArchaeologistData object with signature, arch address, and digging fee allocated to the archaeologist on the sarcophagus
 * */
export const generateArchSignature = async (
  archaeologistSigner: SignerWithAddress,
  sarcophagusParams: SarcophagusNegotiationParams
): Promise<ArchaeologistData> => {
  // calculate sarcophagus' digging fees in sarquitos
  const sarcophagusDiggingFeeSarquitos = ethers.utils
    .parseEther(sarcophagusParams.diggingFeeSarco.toString())
    .toString();

  const doubleHashedShare = doubleHashShare(sarcophagusParams.share);
  // sign sarcophagus negotiation parameters with archaeologist signer
  const { v, r, s } = await sign(
    archaeologistSigner,
    [
      sarcophagusParams.arweaveTxId,
      doubleHashedShare,
      sarcophagusParams.maximumRewrapIntervalSeconds.toString(),
      sarcophagusDiggingFeeSarquitos,
      sarcophagusParams.timestampSeconds.toString(),
    ],
    ["string", "bytes32", "uint256", "uint256", "uint256"]
  );

  return {
    archAddress: archaeologistSigner.address,
    diggingFee: sarcophagusDiggingFeeSarquitos,
    share: sarcophagusParams.share,
    unencryptedShardDoubleHash: doubleHashedShare,
    v,
    r,
    s,
  };
};
