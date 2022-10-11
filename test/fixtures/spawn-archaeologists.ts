import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish } from "ethers";
import { ethers, getUnnamedAccounts } from "hardhat";
import { sign } from "../utils/helpers";
import { SignatureWithAccount } from "../types";
import { BytesLike } from "ethers/lib/utils";
import { ArchaeologistFacet, IERC20 } from "../../typechain";

export interface TestArchaeologist {
  archAddress: string;
  signer: SignerWithAddress;
  diggingFee: BigNumber;
  unencryptedShardDoubleHash: string;
  unencryptedShard: BytesLike;
  v: BigNumberish;
  r: string;
  s: string;
}

export function hashBytes(data: BytesLike): string {
  return ethers.utils.solidityKeccak256(["bytes"], [data]);
}

function doubleHashFromShard(shard: Buffer): string {
  return hashBytes(hashBytes(shard));
}

/**
 * Generates and returns [shards.length] archaeologists
 * with the data needed to register and call create (signatures)
 *
 * Defaults:
 * Total SARCO Balance: 10,000
 * SARCO in free bond: 500
 * Digging Fees: 10
 * MaxRewrapInterval: 4 weeks
 * */
export async function spawnArchaologistsWithSignatures(
  shards: Buffer[],
  arweaveTxId: string,
  archaeologistFacet: ArchaeologistFacet,
  sarcoToken: IERC20,
  diamondAddress: string,
  maxRewrapInterval: number,
  timestamp: number,
  archMinDiggingFee: BigNumber = BigNumber.from("10")
): Promise<[TestArchaeologist[], SignatureWithAccount[]]> {
  const unnamedAccounts = await getUnnamedAccounts();
  const archs: TestArchaeologist[] = [];
  const signatures: SignatureWithAccount[] = [];
  // Use tail-end of unnamed accounts list to populate archaeologists.
  // This allows callers outside this function, but in same test context,
  // to grab accounts from the head-end without worrying about overlap.
  for (
    let accountI = unnamedAccounts.length - 1, shardI = 0;
    accountI >= unnamedAccounts.length - shards.length;
    accountI--, shardI++
  ) {
    const shardDoubleHash = doubleHashFromShard(shards[shardI]);
    const acc = await ethers.getSigner(unnamedAccounts[accountI]);
    const signature = await sign(
      acc,
      [
        arweaveTxId,
        shardDoubleHash,
        maxRewrapInterval.toString(),
        archMinDiggingFee.toString(),
        timestamp.toString(),
      ],
      ["string", "bytes32", "uint256", "uint256", "uint256"]
    );

    archs.push({
      archAddress: acc.address,
      unencryptedShardDoubleHash: shardDoubleHash,
      unencryptedShard: shards[shardI],
      signer: acc,
      diggingFee: archMinDiggingFee,
      v: signature.v,
      r: signature.r,
      s: signature.s,
    });

    // Transfer 10,000 sarco tokens to each archaeologist to be put into free
    // bond, and approve spending
    await sarcoToken.transfer(acc.address, ethers.utils.parseEther("10000"));

    await sarcoToken.connect(acc).approve(diamondAddress, ethers.constants.MaxUint256);

    // Deposit 5000 tokens for each archaeologist so they're ready to be bonded
    await archaeologistFacet
      .connect(acc)
      .registerArchaeologist(
        "myFakePeerId",
        archMinDiggingFee,
        maxRewrapInterval,
        ethers.utils.parseEther("5000")
      );

    signatures.push({ ...signature, account: acc.address });
  }

  return [archs, signatures];
}
