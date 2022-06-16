import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Signature } from "ethers";
import { ethers } from "hardhat";

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
export async function sign(
  signer: SignerWithAddress,
  message: string,
  type: string
): Promise<Signature> {
  const dataHex = ethers.utils.defaultAbiCoder.encode([type], [message]);
  const dataHash = ethers.utils.keccak256(dataHex);
  const dataHashBytes = ethers.utils.arrayify(dataHash);
  const signature = await signer.signMessage(dataHashBytes);
  return ethers.utils.splitSignature(signature);
}
