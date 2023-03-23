import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { split } from "shamirs-secret-sharing-ts";
import { generateHistoryConfig } from "./config";
import { range, signHre } from "./helpers";

export interface SarcophagusData {
  sarcoId: string;
  // A mapping of archaeologist address to the encrypted shard
  shards: { [key: string]: Uint8Array };
}

/**
 * Creates some sarcohpagi provided some archaeologists.
 * @param hre The Hardhat Runtime Environment
 * @param archaeologistSigners The archaeologist signers
 * @param resurrectionTime The resurrection time in seconds
 */
export async function createSarcophagi(
  hre: HardhatRuntimeEnvironment,
  archaeologistSigners: SignerWithAddress[],
  resurrectionTime: number
): Promise<SarcophagusData[]> {
  const maxArchaeologistOnSarcophagus = 25;
  const sarcophagusCount = generateHistoryConfig.sarcophagusCount;

  // Define constants
  const fakePayloadTxId = "fake-payload-tx-id";
  const fakeShardTxId = "fake-shard-payload-id";
  // Needs to be far enough in the future that the sarcophagus will be created
  // Get hre ethers tools
  const { ethers } = hre;
  const { randomBytes, hexlify, keccak256 } = ethers.utils;
  const { getSigners } = ethers;

  const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const maximumRewrapInterval = 604800;
  const diggingFee = 100;

  const embalmer = (await getSigners())[0];
  const recipientAddress = (await getSigners())[0].address;

  // Get the contracts
  const diamond = await hre.ethers.getContract(
    "SarcophagusGoerliV1_Diamond_Proxy"
  );
  const embalmerFacet = await hre.ethers.getContractAt(
    "EmbalmerFacet",
    diamond.address
  );
  const sarcoToken = await hre.ethers.getContract("SarcoTokenMock");

  console.log();
  console.log("Creating sarcophagi...");
  const sarcophagiData = [];
  for (let i = 0; i < sarcophagusCount; i++) {
    // Define the sarcohpagus parameters
    const fakeSarcoId = hexlify(randomBytes(32));

    // The number of archaeologists on the sarcophagus, maxes out at maxArchaeologistOnSarcophagus
    const selectedArchaeologistCount = range(
      1,
      archaeologistSigners.length > maxArchaeologistOnSarcophagus
        ? maxArchaeologistOnSarcophagus
        : archaeologistSigners.length
    );
    const minShards = range(1, selectedArchaeologistCount);
    const name = "Sarcophagus Name";

    // Pick random addresses from the list of archaeologist addresses to be added to the
    // sarcophagus. Do not allow duplicates.
    // Shuffle and slice the array
    const selectedArchaeologistSigners = archaeologistSigners
      .sort(() => 0.5 - Math.random())
      .slice(0, selectedArchaeologistCount);

    // Create the shards using Shamirs Secret Sharing
    const outerLayerPrivateKey =
      "ce6cb1ae13d79a053daba0e960411eba8648b7f7e81c196fd6b36980ce3b3419";
    const shards: Uint8Array[] = split(outerLayerPrivateKey, {
      shares: selectedArchaeologistCount,
      threshold: minShards,
    });

    // Assign a shard to each archaeologist
    const shardsMap: { [key: string]: Uint8Array } = {};
    for (let j = 0; j < selectedArchaeologistSigners.length; j++) {
      const archaeologistSigner = selectedArchaeologistSigners[j];
      const shard = shards[j];
      shardsMap[archaeologistSigner.address] = shard;
    }

    // Create the archaeologist objects to be passed in to the createSarcophagus function
    const archaeologists = [];
    for (let i = 0; i < selectedArchaeologistCount; i++) {
      const archaeologistSigner = selectedArchaeologistSigners[i];

      // Double hash this archaeologist's shard
      const doubleHashedShard = keccak256(
        keccak256(shardsMap[archaeologistSigner.address])
      );
      // arweaveTxId, unencryptedShardDoubleHash, agreedMaximumRewrapInterval, diggingFee, timestamp
      try {
        // The archaeologist signs the double hashed shard and a fake arweave transaction id
        const signature = await signHre(
          hre,
          selectedArchaeologistSigners[i],
          [
            fakeShardTxId,
            doubleHashedShard,
            maximumRewrapInterval.toString(),
            diggingFee.toString(),
            timestamp.toString(),
          ],
          ["string", "bytes32", "uint256", "uint256", "uint256"]
        );
        // const signature = await signHre(
        //   hre,
        //   selectedArchaeologistSigners[i],
        //   [doubleHashedShard, fakeShardTxId],
        //   ["bytes32", "string"]
        // );

        archaeologists.push({
          archAddress: selectedArchaeologistSigners[i].address,
          diggingFee: diggingFee,
          unencryptedShardDoubleHash: doubleHashedShard,
          v: signature.v,
          r: signature.r,
          s: signature.s,
        });
      } catch (_error) {
        const error = _error as Error;
        console.error(
          `(${
            i + 1
          }/${sarcophagusCount}) Failed to sign shard for archaeologist`
        );
        throw new Error(error.message);
      }
    }

    try {
      // Approve the diamond contract to use the sarco token
      await sarcoToken
        .connect(embalmer)
        .approve(diamond.address, ethers.constants.MaxUint256);

      // Create the sarcophagus
      await embalmerFacet.connect(embalmer).createSarcophagus(
        fakeSarcoId,
        {
          name,
          recipient: recipientAddress,
          resurrectionTime: BigNumber.from(resurrectionTime),
          maximumRewrapInterval,
          minShards,
          timestamp,
        },
        archaeologists,
        [fakePayloadTxId, fakeShardTxId]
      );
      console.log(
        `(${
          i + 1
        }/${sarcophagusCount}) Created sarcophagus ${fakeSarcoId} with ${minShards}/${selectedArchaeologistCount} shards`
      );
      sarcophagiData.push({
        sarcoId: fakeSarcoId,
        shards: shardsMap,
      });
    } catch (_error) {
      const error = _error as Error;
      console.error(
        `(${i + 1}/${sarcophagusCount}) Failed to create sarcophagus.`
      );
      console.error(
        "If generate-history has already been run on this node it will fail. Please restart the node and try again."
      );
      throw new Error(error.message);
    }
  }
  return sarcophagiData;
}
