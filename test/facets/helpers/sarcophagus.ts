import time from "../../utils/time";
import { getFreshAccount } from "./accounts";
import { fundAndApproveAccount } from "./sarcoToken";
import { generateKeyshares } from "./shamirSecretSharing";
import {
  ArchaeologistParameters,
  registerArchaeologist,
} from "./archaeologist";
import {
  ArchaeologistData,
  createArchSignature,
  SarcophagusNegotiationParams,
} from "./archaeologistSignature";
import { getContracts } from "./contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish, Bytes } from "ethers";
import { BytesLike } from "ethers/lib/utils";

const { ethers } = require("hardhat");

/**
 * Contains information on a test sarcophagus
 * used to generate archaeologists and signatures and register a sarcophagus
 */
export interface SarcophagusData {
  sarcoId: Bytes;
  name: string;
  embalmer: SignerWithAddress;
  recipientAddress: string;
  resurrectionTimeSeconds: number;
  maximumRewrapIntervalSeconds: number;
  creationTime: number;
  threshold: number;
  rawKeyShares: Buffer[];
  rawOuterKey: string;
  arweaveTxIds: [string, string];
}

/**
 * Accepts an optional set of sarcophagus parameters and falls back to defaults for missing values
 * does not modify any state (embalmers are not given a balance of sarco)
 * To create a sarcophagus from this data, send funds to the embalmer, generate funded archaeologists for each keyshare, and call createSarcophagus
 * @param params - required: threshold, totalShares, maximumRewrapIntervalSeconds
 */
export const createSarcophagusData = async (params: {
  threshold: number;
  totalShares: number;
  maximumRewrapIntervalSeconds: number;
  // optional
  resurrectionTime?: number;
  sarcoId?: string;
  name?: string;
  creationTime?: number;
  recipientAddress?: string;
  embalmerAddress?: string;
  arweaveTxIds?: [string, string];
}): Promise<SarcophagusData> => {
  // generate new accounts for an embalmer and a recipient
  const embalmerAddress =
    params.embalmerAddress !== undefined
      ? params.embalmerAddress
      : (await getFreshAccount()).address;
  const embalmer = await ethers.getSigner(embalmerAddress);
  const recipientAddress =
    params.recipientAddress !== undefined
      ? params.recipientAddress
      : (await getFreshAccount()).address;

  // create a unique name for the sarcophagus and derive the id
  const name =
    params.name !== undefined
      ? params.name
      : `Sarcophagus by ${embalmerAddress} for ${recipientAddress}`;
  const sarcoId =
    params.sarcoId !== undefined
      ? params.sarcoId
      : ethers.utils.solidityKeccak256(["string"], [name]);

  // get the current time which will be signed off on by archaeologists as the negotiation timestamp
  const creationTime =
    params.creationTime !== undefined
      ? params.creationTime
      : await time.latest();

  const resurrectionTime =
    params.resurrectionTime !== undefined
      ? params.resurrectionTime
      : creationTime + params.maximumRewrapIntervalSeconds;

  // generate the keyshares for the sarcophagus
  const { shares, key } = generateKeyshares(
    params.threshold,
    params.totalShares
  );

  const arweaveTxIds: [string, string] =
    params.arweaveTxIds !== undefined
      ? params.arweaveTxIds
      : ["FilePayloadTxId", "EncryptedShardTxId"];
  return {
    sarcoId,
    name,
    recipientAddress,
    embalmer,
    resurrectionTimeSeconds: resurrectionTime,
    maximumRewrapIntervalSeconds: params.maximumRewrapIntervalSeconds,
    threshold: params.threshold,
    creationTime,
    rawKeyShares: shares,
    rawOuterKey: key,
    arweaveTxIds,
  };
};

/**
 * Formats a sarcophagusData object and set of archaeologists to be passed into createSarcophagus contract call
 * @param sarcophagusData
 * @param archaeologists
 * @returns tuple of createSarcophagus arguments
 */
export const buildCreateSarcophagusArgs = (
  sarcophagusData: SarcophagusData,
  archaeologists: ArchaeologistData[]
): [
  sarcoId: BytesLike,
  sarcophagusParams: {
    name: string;
    recipientAddress: string;
    resurrectionTime: BigNumberish;
    maximumRewrapInterval: BigNumberish;
    threshold: BigNumberish;
    creationTime: BigNumberish;
  },
  selectedArchaeologists: {
    archAddress: string;
    diggingFee: BigNumberish;
    doubleHashedKeyShare: BytesLike;
    v: BigNumberish;
    r: BytesLike;
    s: BytesLike;
  }[],
  arweaveTxIds: [string, string]
] => {
  return [
    sarcophagusData.sarcoId,
    {
      name: sarcophagusData.name,
      recipientAddress: sarcophagusData.recipientAddress,
      resurrectionTime: sarcophagusData.resurrectionTimeSeconds,
      maximumRewrapInterval: sarcophagusData.maximumRewrapIntervalSeconds,
      threshold: sarcophagusData.threshold,
      creationTime: sarcophagusData.creationTime,
    },
    archaeologists,
    sarcophagusData.arweaveTxIds,
  ];
};

/**
 * Registers and funds archaeologists for the supplied keyshares
 * Creates archaeologist signatures on the keyshares and sarcophagus negotiation parameters
 *
 * Sets default values on the archaeologists:
 *  profileMinDiggingFee: 100
 *  profileMaxRewrapIntervalSeconds: uses max rewrap interval set on the sarcophagus
 *  sarcoBalance: 10_000
 *  freeBondSarco: 10_000
 * and on the sarcophagus/archaeologist agreement:
 *  diggingFeeSarco: 100
 *
 * @param sarcophagusData
 */
export const registerDefaultArchaeologistsAndCreateSignatures = async (
  sarcophagusData: SarcophagusData
): Promise<ArchaeologistData[]> =>
  await Promise.all(
    sarcophagusData.rawKeyShares.map(async (rawKeyShare: Buffer) =>
      registerArchaeologistAndCreateSignature(
        {
          arweaveTxId: sarcophagusData.arweaveTxIds[1],
          rawKeyShare,
          maximumRewrapIntervalSeconds:
            sarcophagusData.maximumRewrapIntervalSeconds,
          creationTime: sarcophagusData.creationTime,
          diggingFeeSarco: 100,
        },
        {
          profileMinDiggingFee: 100,
          profileMaxRewrapIntervalSeconds:
            sarcophagusData.maximumRewrapIntervalSeconds,
          sarcoBalance: 10_000,
          freeBondSarco: 10_000,
        }
      )
    )
  );

/**
 * Registers and funds an archaeologist for the supplied key share and sarcophagus negotiation parameters
 * Creates a signature from the archaeologist signer
 * @param sarcophagusNegotiationParams
 * @param archaeologistParams
 * @returns ArchaeologistData containing the signature, address, and digging fee allocated to the archaeologist on the sarcophagus
 */
export const registerArchaeologistAndCreateSignature = async (
  sarcophagusNegotiationParams: SarcophagusNegotiationParams,
  archaeologistParams: ArchaeologistParameters
): Promise<ArchaeologistData> => {
  const archaeologistSigner = await registerArchaeologist(archaeologistParams);
  return await createArchSignature(
    archaeologistSigner,
    sarcophagusNegotiationParams
  );
};

/**
 * Creates a sarcophagus with the supplied parameters
 * funds the embalmer account
 * generates and registers a default archaeologist responsible for each keyshare
 * @param params
 */
export const registerSarcophagusWithArchaeologists = async (params: {
  totalShares: number;
  threshold: number;
  maximumRewrapIntervalSeconds: number;
}): Promise<{
  archaeologists: ArchaeologistData[];
  sarcophagusData: SarcophagusData;
}> => {
  const sarcophagusData = await createSarcophagusData({
    threshold: params.threshold,
    totalShares: params.totalShares,
    maximumRewrapIntervalSeconds: params.maximumRewrapIntervalSeconds,
  });

  // transfer 100k sarco to the embalmer and approve the diamond to spend on their behalf
  await fundAndApproveAccount(sarcophagusData.embalmer, 100_000);

  // register archaeologist profiles for each keyshare and create a signature from each archaeologist
  const archaeologists = await registerDefaultArchaeologistsAndCreateSignatures(
    sarcophagusData
  );

  await (await getContracts()).embalmerFacet
    .connect(sarcophagusData.embalmer)
    .createSarcophagus(
      ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
    );

  return {
    sarcophagusData,
    archaeologists,
  };
};
