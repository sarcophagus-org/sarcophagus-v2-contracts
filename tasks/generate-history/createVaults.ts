import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { split } from "shamirs-secret-sharing-ts";
import { generateHistoryConfig } from "./config";
import { range, signHre } from "./helpers";

export interface VaultData {
  vaultId: string;
  // A mapping of signatory address to the encrypted shard
  shards: { [key: string]: Uint8Array };
}

/**
 * Creates some vault provided some signatories.
 * @param hre The Hardhat Runtime Environment
 * @param signatorySigners The signatory signers
 * @param resurrectionTime The resurrection time in seconds
 */
export async function createVaults(
  hre: HardhatRuntimeEnvironment,
  signatorySigners: SignerWithAddress[],
  resurrectionTime: number
): Promise<VaultData[]> {
  const maxSignatoryOnVault = 25;
  const vaultCount = generateHistoryConfig.vaultCount;

  // Define constants
  const fakePayloadTxId = "fake-payload-tx-id";
  const fakeShardTxId = "fake-shard-payload-id";
  // Needs to be far enough in the future that the vault will be created
  // Get hre ethers tools
  const { ethers } = hre;
  const { randomBytes, hexlify, keccak256 } = ethers.utils;
  const { getSigners } = ethers;

  const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const maximumRewrapInterval = 604800;
  const diggingFee = 100;

  const vaultOwner = (await getSigners())[0];
  const recipientAddress = (await getSigners())[0].address;

  // Get the contracts
  const diamond = await hre.ethers.getContract("Diamond_DiamondProxy");
  const vaultOwnerFacet = await hre.ethers.getContractAt("VaultOwnerFacet", diamond.address);
  const heritageToken = await hre.ethers.getContract("HeritageTokenMock");

  console.log();
  console.log("Creating vault...");
  const vaultData = [];
  for (let i = 0; i < vaultCount; i++) {
    // Define the sarcohpagus parameters
    const fakeVaultId = hexlify(randomBytes(32));

    // The number of signatories on the vault, maxes out at maxSignatoryOnVault
    const selectedSignatoryCount = range(
      1,
      signatorySigners.length > maxSignatoryOnVault
        ? maxSignatoryOnVault
        : signatorySigners.length
    );
    const minShards = range(1, selectedSignatoryCount);
    const name = "Vault Name";

    // Pick random addresses from the list of signatory addresses to be added to the
    // vault. Do not allow duplicates.
    // Shuffle and slice the array
    const selectedSignatorySigners = signatorySigners
      .sort(() => 0.5 - Math.random())
      .slice(0, selectedSignatoryCount);

    // Create the shards using Shamirs Secret Sharing
    const outerLayerPrivateKey = "ce6cb1ae13d79a053daba0e960411eba8648b7f7e81c196fd6b36980ce3b3419";
    const shards: Uint8Array[] = split(outerLayerPrivateKey, {
      shares: selectedSignatoryCount,
      threshold: minShards,
    });

    // Assign a shard to each signatory
    const shardsMap: { [key: string]: Uint8Array } = {};
    for (let j = 0; j < selectedSignatorySigners.length; j++) {
      const signatorySigner = selectedSignatorySigners[j];
      const shard = shards[j];
      shardsMap[signatorySigner.address] = shard;
    }

    // Create the signatory objects to be passed in to the createVault function
    const signatories = [];
    for (let i = 0; i < selectedSignatoryCount; i++) {
      const signatorySigner = selectedSignatorySigners[i];

      // Double hash this signatory's shard
      const doubleHashedShard = keccak256(keccak256(shardsMap[signatorySigner.address]));
      // arweaveTxId, unencryptedShardDoubleHash, agreedMaximumRewrapInterval, diggingFee, timestamp
      try {
        // The signatory signs the double hashed shard and a fake arweave transaction id
        const signature = await signHre(
          hre,
          selectedSignatorySigners[i],
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
        //   selectedSignatorySigners[i],
        //   [doubleHashedShard, fakeShardTxId],
        //   ["bytes32", "string"]
        // );

        signatories.push({
          signatoryAddress: selectedSignatorySigners[i].address,
          diggingFee: diggingFee,
          unencryptedShardDoubleHash: doubleHashedShard,
          v: signature.v,
          r: signature.r,
          s: signature.s,
        });
      } catch (_error) {
        const error = _error as Error;
        console.error(`(${i + 1}/${vaultCount}) Failed to sign shard for signatory`);
        throw new Error(error.message);
      }
    }

    try {
      // Approve the diamond contract to use the heritage token
      await heritageToken.connect(vaultOwner).approve(diamond.address, ethers.constants.MaxUint256);

      // Create the vault
      await vaultOwnerFacet.connect(vaultOwner).createVault(
        fakeVaultId,
        {
          name,
          recipient: recipientAddress,
          resurrectionTime: BigNumber.from(resurrectionTime),
          canBeTransferred: false,
          maximumRewrapInterval,
          minShards,
          timestamp,
        },
        signatories,
        [fakePayloadTxId, fakeShardTxId]
      );
      console.log(
        `(${
          i + 1
        }/${vaultCount}) Created vault ${fakeVaultId} with ${minShards}/${selectedSignatoryCount} shards`
      );
      vaultData.push({
        vaultId: fakeVaultId,
        shards: shardsMap,
      });
    } catch (_error) {
      const error = _error as Error;
      console.error(`(${i + 1}/${vaultCount}) Failed to create vault.`);
      console.error(
        "If generate-history has already been run on this node it will fail. Please restart the node and try again."
      );
      throw new Error(error.message);
    }
  }
  return vaultData;
}
