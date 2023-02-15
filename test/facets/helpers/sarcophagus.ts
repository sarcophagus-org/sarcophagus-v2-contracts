import time from "../../utils/time";
import { accountGenerator } from "./accounts";
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
import { BigNumberish } from "ethers";
import { BytesLike } from "ethers/lib/utils";

const { ethers } = require("hardhat");
const crypto = require("crypto");

export const diggingFeesPerSecond_10_000_SarcoMonthly = "4000000000000000";

/**
 * Contains information on a test sarcophagus
 * used to generate archaeologists and signatures and register a sarcophagus
 */
export interface SarcophagusData {
  sarcoId: string;
  name: string;
  embalmer: SignerWithAddress;
  recipientAddress: string;
  resurrectionTimeSeconds: number;
  maximumRewrapIntervalSeconds: number;
  maximumResurrectionTimeSeconds: number;
  creationTimeSeconds: number;
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
  maximumResurrectionTime?: number;
  resurrectionTime?: number;
  sarcoId?: string;
  name?: string;
  creationTimeSeconds?: number;
  recipientAddress?: string;
  embalmerAddress?: string;
  embalmerFunds?: number;
}): Promise<SarcophagusData> => {
  const threshold = params.threshold ?? 3;
  const totalShares = params.totalArchaeologists ?? 5;
  const maximumRewrapIntervalSeconds =
    params.maximumRewrapIntervalSeconds ?? time.duration.weeks(4);

  const maximumResurrectionTimeSeconds =
    params.maximumResurrectionTime ??
    Math.floor(new Date().getTime() / 1000) + time.duration.years(2);

  // generate new accounts for an embalmer and a recipient
  const embalmerAddress =
    params.embalmerAddress ?? (await accountGenerator.newAccount()).address;
  const embalmer = await ethers.getSigner(embalmerAddress);

  await fundAndApproveAccount(embalmer, params.embalmerFunds || 100_000);

  const recipientAddress =
    params.recipientAddress ?? (await accountGenerator.newAccount()).address;

  // create a unique name for the sarcophagus and derive the id
  const name =
    params.name ?? `Sarcophagus by ${embalmerAddress} for ${recipientAddress}`;
  const sarcoId =
    params.sarcoId ?? ethers.utils.solidityKeccak256(["string"], [name]);

  // get the current time which will be signed off on by archaeologists as the negotiation timestamp
  const creationTimeSeconds =
    params.creationTimeSeconds ?? (await time.latest());

  const resurrectionTimeSeconds =
    params.resurrectionTime ??
    creationTimeSeconds + maximumRewrapIntervalSeconds;

  // generate the key pairs for the sarcophagus
  const privateKeys = Array.from(
    { length: totalShares },
    () => "0x" + crypto.randomBytes(32).toString("hex")
  );
  const publicKeys = privateKeys.map(
    (privateKey: string) => new ethers.utils.SigningKey(privateKey).publicKey
  );

  return {
    sarcoId,
    name,
    recipientAddress,
    embalmer,
    resurrectionTimeSeconds,
    maximumRewrapIntervalSeconds,
    maximumResurrectionTimeSeconds,
    threshold,
    creationTimeSeconds,
    privateKeys,
    publicKeys,
  };
};

/**
 * Registers archaeologists for the supplied key shares on the contracts and funds them
 * Creates archaeologist signatures on the key shares and sarcophagus negotiation parameters
 *
 * Sets default values on the archaeologists:
 *  profileMinDiggingFeePerSecondSarquito: 10000 / month
 *  profileMaxRewrapIntervalSeconds: uses max rewrap interval set on the sarcophagus
 *  sarcoBalance: 10_000
 *  freeBondSarco: 10_000
 * and on the sarcophagus/archaeologist agreement:
 *  diggingFeePerSecondSarco: 10000 / month
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
          maximumResurrectionTimeSeconds:
            sarcophagusData.maximumResurrectionTimeSeconds,
          creationTime: sarcophagusData.creationTimeSeconds,
          diggingFeePerSecondSarquito: diggingFeesPerSecond_10_000_SarcoMonthly,
        },
        {
          profileMinDiggingFeePerSecondSarquito:
            diggingFeesPerSecond_10_000_SarcoMonthly,
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
 *
 * Funds the embalmer account.
 *
 * Generates and registers a default archaeologist responsible for each keyshare
 * @param params Basic Sarco creation params
 */
export const createSarcophagusWithRegisteredCursedArchaeologists =
  async (params?: {
    totalArchaeologists?: number;
    threshold?: number;
    maximumRewrapIntervalSeconds?: number;
  }): Promise<{
    cursedArchaeologists: ArchaeologistData[];
    createdSarcophagusData: SarcophagusData;
  }> => {
    const sarcophagusData = await createSarcophagusData({ ...params });

    // register archaeologist profiles for each key and create a signature from each archaeologist
    const archaeologists =
      await registerDefaultArchaeologistsAndCreateSignatures(sarcophagusData);

    await (await getContracts()).embalmerFacet
      .connect(sarcophagusData.embalmer)
      .createSarcophagus(
        ...buildCreateSarcophagusArgs(sarcophagusData, archaeologists)
      );

    return {
      createdSarcophagusData: sarcophagusData,
      cursedArchaeologists: archaeologists,
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
    maximumResurrectionTime: BigNumberish;
    threshold: BigNumberish;
    creationTime: BigNumberish;
  },
  selectedArchaeologists: {
    archAddress: string;
    diggingFeePerSecond: BigNumberish;
    publicKey: BytesLike;
    v: BigNumberish;
    r: BytesLike;
    s: BytesLike;
  }[],
  arweaveTxId: string
] => {
  return [
    sarcophagusData.sarcoId,
    {
      name: sarcophagusData.name,
      recipientAddress: sarcophagusData.recipientAddress,
      resurrectionTime: sarcophagusData.resurrectionTimeSeconds,
      maximumRewrapInterval: sarcophagusData.maximumRewrapIntervalSeconds,
      maximumResurrectionTime: sarcophagusData.maximumResurrectionTimeSeconds,
      threshold: sarcophagusData.threshold,
      creationTime: sarcophagusData.creationTimeSeconds,
    },
    archaeologists.map((archaeologist: ArchaeologistData) => ({
      archAddress: archaeologist.archAddress,
      publicKey: archaeologist.publicKey,
      diggingFeePerSecond: archaeologist.diggingFeePerSecondSarquito,
      v: archaeologist.v,
      r: archaeologist.r,
      s: archaeologist.s,
    })),
    "encrypted key share tx",
  ];
};
