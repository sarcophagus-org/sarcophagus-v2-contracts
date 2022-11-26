import { ethers } from "hardhat";
import time from "../../utils/time";
import { getFreshAccount } from "./accounts";
import { fundAndApproveAccount } from "./sarcoToken";
import { generateKeyshares } from "./shamirSecretSharing";
import {
  ArchaeologistData,
  createAndRegisterArchaeologist,
  generateArchSignature,
} from "./archaeologist";
import { getContracts } from "./contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

/**
 * Creates a sarcophagus with the supplied parameters
 * generates and registers an archaeologist with 10k cursed bond and no free bond to manage each keyshare
 * */
export const generateSarcophagusWithArchaeologists = async (params: {
  totalShares: number;
  threshold: number;
  maximumRewrapIntervalSeconds: number;
  resurrectionTimeSeconds: number;
}): Promise<{
  archaeologists: ArchaeologistData[];
  embalmer: SignerWithAddress;
  sarcophagus: {
    minShards: number;
    maximumRewrapInterval: number;
    resurrectionTime: number;
    recipient: string;
    sarcoId: string;
    timestampSeconds: number;
  };
}> => {
  // arbitrary hardcoded tx ids - archaeologist must sign off on EncryptedShardTxId being used to create the sarcophagus
  const arweaveTxIds: [string, string] = [
    "FilePayloadTxId",
    "EncryptedShardTxId",
  ];

  // get the current time which will be signed off on by archaeologists as the negotiation timestamp
  const timestampSeconds = await time.latest();

  // generate new accounts for an embalmer and a recipient
  const embalmer = await getFreshAccount();
  const recipient = await getFreshAccount();

  // create a unique name for the sarcophagus and derive the id
  const name = `Sarcophagus by ${embalmer.address} for ${recipient.address}`;
  const sarcoId = ethers.utils.solidityKeccak256(["string"], [name]);

  // transfer 100k sarco to the embalmer and approve the diamond to spend on their behalf
  await fundAndApproveAccount(embalmer, 100_000);

  // generate the keyshares for the sarcophagus
  const { shares } = generateKeyshares(params.threshold, params.totalShares);

  // create and register an archaeologist for each keyshare
  const archaeologists: ArchaeologistData[] = await Promise.all(
    shares.map(async (share: Buffer) => {
      const archaeologistSigner = await createAndRegisterArchaeologist({
        minDiggingFeeSarco: 100,
        maximumRewrapIntervalSeconds:
          params.maximumRewrapIntervalSeconds + time.duration.weeks(1),
        sarcoBalance: 10_000,
        freeBondSarco: 10_000,
      });
      return await generateArchSignature(archaeologistSigner, {
        arweaveTxId: arweaveTxIds[1],
        share,
        maximumRewrapIntervalSeconds: params.maximumRewrapIntervalSeconds,
        timestampSeconds,
        diggingFeeSarco: 100,
      });
    })
  );

  await (await getContracts()).embalmerFacet
    .connect(embalmer)
    .createSarcophagus(
      sarcoId,
      {
        name,
        recipientAddress: recipient.address,
        resurrectionTime: params.resurrectionTimeSeconds,
        maximumRewrapInterval: params.maximumRewrapIntervalSeconds,
        threshold: params.threshold,
        creationTime: timestampSeconds,
      },
      archaeologists,
      arweaveTxIds
    );

  return {
    embalmer,
    sarcophagus: {
      sarcoId,
      recipient: recipient.address,
      resurrectionTime: params.resurrectionTimeSeconds,
      maximumRewrapInterval: params.maximumRewrapIntervalSeconds,
      minShards: params.threshold,
      timestampSeconds,
    },
    archaeologists,
  };
};
