import { BigNumber } from "ethers";
import { ethers, getUnnamedAccounts } from "hardhat";

export const setupArchaeologists = async () => {
  const unnamedAccounts = await getUnnamedAccounts();

  return [
    {
      account: unnamedAccounts[1],
      archAddress: unnamedAccounts[1],
      signer: await ethers.getSigner(unnamedAccounts[1]),
      bounty: BigNumber.from("100"),
      diggingFee: BigNumber.from("5"),
      storageFee: BigNumber.from("10"),
      hashedShard: ethers.utils.solidityKeccak256(
        ["string"],
        [unnamedAccounts[1]]
      ),
    },
    {
      account: unnamedAccounts[2],
      archAddress: unnamedAccounts[2],
      signer: await ethers.getSigner(unnamedAccounts[2]),
      bounty: BigNumber.from("120"),
      diggingFee: BigNumber.from("6"),
      storageFee: BigNumber.from("13"),
      hashedShard: ethers.utils.solidityKeccak256(
        ["string"],
        [unnamedAccounts[2]]
      ),
    },
    {
      account: unnamedAccounts[3],
      archAddress: unnamedAccounts[3],
      signer: await ethers.getSigner(unnamedAccounts[3]),
      bounty: BigNumber.from("130"),
      diggingFee: BigNumber.from("4"),
      storageFee: BigNumber.from("9"),
      hashedShard: ethers.utils.solidityKeccak256(
        ["string"],
        [unnamedAccounts[3]]
      ),
    },
  ];
};
