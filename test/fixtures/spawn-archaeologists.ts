import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers, getUnnamedAccounts } from "hardhat";
import { sign } from "../utils/helpers";
import { SignatureWithAccount } from "../../types";
import { BytesLike } from "ethers/lib/utils";
import { ArchaeologistFacet, IERC20 } from "../../typechain";

export interface TestArchaeologist {
  archAddress: string;
  signer: SignerWithAddress;
  diggingFee: BigNumber;
  hashedShard: string;
  unencryptedShard: BytesLike;
}

/**
 * Generates and returns [shards.length] archaeologists, each
 * with 10,000 sarco tokens and a 5000-sarco token bond deposit,
 * along with their signatures on the sarcoId. Storage fee,
 * digging fee for each generated archaeologist are
 * set to a constant 20, 10, and 100 sarco tokens respectively.
 * */
export async function spawnArchaologistsWithSignatures(
  shards: Buffer[],
  sarcoId: string,
  archaeologistFacet: ArchaeologistFacet,
  sarcoToken: IERC20,
  diamondAddress: string
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
    const acc = await ethers.getSigner(unnamedAccounts[accountI]);
    const signature = await sign(acc, sarcoId, "bytes32");

    archs.push({
      archAddress: acc.address,
      hashedShard: ethers.utils.solidityKeccak256(["bytes"], [shards[shardI]]),
      unencryptedShard: shards[shardI],
      signer: acc,
      diggingFee: BigNumber.from("10")
    });

    // Transfer 10,000 sarco tokens to each archaeologist to be put into free
    // bond, and approve spending
    await sarcoToken.transfer(acc.address, ethers.utils.parseEther("10000"));

    await sarcoToken.connect(acc).approve(diamondAddress, ethers.constants.MaxUint256);

    // Deposit 5000 tokens for each archaeologist so they're ready to be bonded
    await archaeologistFacet.connect(acc).registerArchaeologist(
      "myFakePeerId",
      ethers.utils.parseEther("10"),
      BigNumber.from("1000"),
      ethers.utils.parseEther("5000")
    );

    signatures.push({ ...signature, account: acc.address });
  }

  return [archs, signatures];
}
