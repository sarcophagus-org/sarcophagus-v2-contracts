import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish } from "ethers";
import { ethers, getUnnamedAccounts } from "hardhat";
import { sign } from "../utils/helpers";
import { SignatureWithAccount } from "../types";
import { BytesLike } from "ethers/lib/utils";
import { SignatoryFacet, IERC20 } from "../../typechain";

export interface TestSignatory {
  signatoryAddress: string;
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
 * Generates and returns [shards.length] signatories
 * with the data needed to register and call create (signatures)
 *
 * Defaults:
 * Total SARCO Balance: 10,000
 * SARCO in free bond: 500
 * Digging Fees: 10
 * MaxRewrapInterval: 4 weeks
 * */
export async function spawnSignatoriesWithSignatures(
  shards: Buffer[],
  arweaveTxId: string,
  signatoryFacet: SignatoryFacet,
  heritageToken: IERC20,
  diamondAddress: string,
  maxRewrapInterval: number,
  timestamp: number,
  signatoryMinDiggingFee: BigNumber = ethers.utils.parseEther("10")
): Promise<[TestSignatory[], SignatureWithAccount[]]> {
  const unnamedAccounts = await getUnnamedAccounts();
  const signatories: TestSignatory[] = [];
  const signatures: SignatureWithAccount[] = [];
  // Use tail-end of unnamed accounts list to populate signatories.
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
        signatoryMinDiggingFee.toString(),
        timestamp.toString(),
      ],
      ["string", "bytes32", "uint256", "uint256", "uint256"]
    );

    signatories.push({
      signatoryAddress: acc.address,
      unencryptedShardDoubleHash: shardDoubleHash,
      unencryptedShard: shards[shardI],
      signer: acc,
      diggingFee: signatoryMinDiggingFee,
      v: signature.v,
      r: signature.r,
      s: signature.s,
    });

    // Transfer 10,000 heritage tokens to each signatory to be put into free
    // bond, and approve spending
    await heritageToken.transfer(acc.address, ethers.utils.parseEther("10000"));

    await heritageToken.connect(acc).approve(diamondAddress, ethers.constants.MaxUint256);

    // Deposit 5000 tokens for each signatory so they're ready to be bonded
    await signatoryFacet
      .connect(acc)
      .registerSignatory(
        "myFakePeerId",
        signatoryMinDiggingFee,
        maxRewrapInterval,
        ethers.utils.parseEther("5000")
      );

    signatures.push({ ...signature, account: acc.address });
  }

  return [signatories, signatures];
}
