import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Signature } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * Increases the local node's next block timestap to the given timestamp.
 */
export async function increaseTo(hre: HardhatRuntimeEnvironment, to: number): Promise<void> {
  await hre.ethers.provider.send("evm_setNextBlockTimestamp", [to]);
  await hre.ethers.provider.send("evm_mine", []);
}

/**
 * Returns a random integer between min and max
 */
export function range(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Flattens an array
 */
function flat(data: string | string[]): string[] {
  return data instanceof Array ? data : [data];
}

/**
 * Signs a message as any EVM compatible type and returns the signature and the
 * data hash that was signed. The bytes value that was signed is returned so
 * that it may be passed into the ecrecover function.
 *
 * @param message The message to sign
 * @param signer The signer
 * @param type The type of the message as a string (must be EVM compatible)
 * @returns The signature and the bytes that were signed
 */
export async function signHre(
  hre: HardhatRuntimeEnvironment,
  signer: SignerWithAddress,
  message: string | string[],
  type: string | string[]
): Promise<Signature> {
  const dataHex = hre.ethers.utils.defaultAbiCoder.encode(flat(type), flat(message));
  const dataHash = hre.ethers.utils.keccak256(dataHex);
  const dataHashBytes = hre.ethers.utils.arrayify(dataHash);
  const signature = await signer.signMessage(dataHashBytes);
  return hre.ethers.utils.splitSignature(signature);
}
