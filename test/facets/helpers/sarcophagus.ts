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
import { BigNumber, BigNumberish, Bytes } from "ethers";
import { BytesLike } from "ethers/lib/utils";
const crypto = require("crypto");

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
  privateKeys: string[];
  publicKeys: string[];
}

/**
 * Accepts an optional set of sarcophagus parameters and falls back to defaults for missing values
 * funds the embalmer account and approves diamond spending
 * does not modify contract state aside from funding embalmer
 *
 * To create a sarcophagus from this data, send funds to the embalmer, generate funded archaeologists for each keyshare, and call createSarcophagus
 * @param params
 */
export const createSarcophagusData = async (params: {
  threshold?: number;
  totalArchaeologists?: number;
  maximumRewrapIntervalSeconds?: number;
  resurrectionTime?: number;
  sarcoId?: string;
  name?: string;
  creationTime?: number;
  recipientAddress?: string;
  embalmerAddress?: string;
  embalmerFunds?: number;
}): Promise<SarcophagusData> => {
  const threshold = params.threshold !== undefined ? params.threshold : 3;
  const totalShares =
    params.totalArchaeologists !== undefined ? params.totalArchaeologists : 5;
  const maximumRewrapIntervalSeconds =
    params.maximumRewrapIntervalSeconds !== undefined
      ? params.maximumRewrapIntervalSeconds
      : await time.duration.weeks(4);

  // generate new accounts for an embalmer and a recipient
  const embalmerAddress =
    params.embalmerAddress !== undefined
      ? params.embalmerAddress
      : (await getFreshAccount()).address;
  const embalmer = await ethers.getSigner(embalmerAddress);
  await fundAndApproveAccount(embalmer, params.embalmerFunds || 100_000);

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

  const resurrectionTimeSeconds =
    params.resurrectionTime !== undefined
      ? params.resurrectionTime
      : creationTime + maximumRewrapIntervalSeconds;

  // generate the key pairs for the sarcophagus
  const privateKeys = Array.from({ length: totalShares }, () =>
    crypto.randomBytes(32).toString("hex")
  );
  const publicKeys = privateKeys.map(
    (privateKey: string) =>
      new ethers.utils.SigningKey("0x" + privateKey).publicKey
  );

  return {
    sarcoId,
    name,
    recipientAddress,
    embalmer,
    resurrectionTimeSeconds,
    maximumRewrapIntervalSeconds,
    threshold,
    creationTime,
    privateKeys,
    publicKeys,
  };
};

/**
 * Registers archaeologists for the supplied key shares on the contracts and funds them
 * Creates archaeologist signatures on the key shares and sarcophagus negotiation parameters
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
    sarcophagusData.privateKeys.map(async (privateKey: string, index: number) =>
      registerArchaeologistAndCreateSignature(
        {
          publicKey: sarcophagusData.publicKeys[index],
          privateKey,
          maximumRewrapIntervalSeconds:
            sarcophagusData.maximumRewrapIntervalSeconds,
          creationTime: sarcophagusData.creationTime,
          diggingFeeSarco: 100,
        },
        {
          profileMinDiggingFeeSarco: 100,
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
export const registerSarcophagusWithArchaeologists = async (params?: {
  totalArchaeologists?: number;
  threshold?: number;
  maximumRewrapIntervalSeconds?: number;
}): Promise<{
  archaeologists: ArchaeologistData[];
  sarcophagusData: SarcophagusData;
}> => {
  const sarcophagusData = await createSarcophagusData({
    threshold: params?.threshold,
    totalArchaeologists: params?.totalArchaeologists,
    maximumRewrapIntervalSeconds: params?.maximumRewrapIntervalSeconds,
  });

  // register archaeologist profiles for each key and create a signature from each archaeologist
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
    publicKey: BytesLike;
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
    archaeologists.map((archaeologist: ArchaeologistData) => ({
      archAddress: archaeologist.archAddress,
      publicKey: archaeologist.publicKey,
      diggingFee: BigNumber.from(archaeologist.diggingFeeSarquitos),
      v: archaeologist.v,
      r: archaeologist.r,
      s: archaeologist.s,
    })),
    ["sarcophagus payload tx", "encrypted key share tx"],
  ];
};
