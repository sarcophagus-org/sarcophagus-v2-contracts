import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Signature } from "ethers";
import { ethers } from "hardhat";
import { ArchaeologistFacet, SarcoTokenMock } from "../../typechain";

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

/**
 * Increase the timestamp of the next block by a given number of seconds.
 *
 * @param sec The number of seconds to increase the next block by
 */
export const increaseNextBlockTimestamp = async (
  sec: number
): Promise<void> => {
  await ethers.provider.send("evm_setNextBlockTimestamp", [
    (await ethers.provider.getBlock("latest")).timestamp + sec,
  ]);
};

/**
 * Sets up the archaeologists for the tests
 *
 * @param archaeologistFacet The archaeologist facet
 * @param archaeologists The list of archaeologists
 * @param diamondAddress The address of the diamond
 * @param embalmer The embalmer
 * @param sarcoToken The sarco token
 */
export const setupArchaeologists = async (
  archaeologistFacet: ArchaeologistFacet,
  archaeologists: SignerWithAddress[],
  diamondAddress: string,
  embalmer: SignerWithAddress,
  sarcoToken: SarcoTokenMock
): Promise<void> => {
  // Approve the embalmer on the sarco token so transferFrom will work
  await sarcoToken
    .connect(embalmer)
    .approve(diamondAddress, ethers.constants.MaxUint256);

  for (const archaeologist of archaeologists) {
    // Transfer 10,000 sarco tokens to each archaeologist to be put into free
    // bond
    await sarcoToken.transfer(archaeologist.address, BigNumber.from(10_000));

    // Approve the archaeologist on the sarco token so transferFrom will work
    await sarcoToken
      .connect(archaeologist)
      .approve(diamondAddress, ethers.constants.MaxUint256);

    // Deposit some free bond to the contract so initializeSarcophagus will
    // work
    await archaeologistFacet
      .connect(archaeologist)
      .depositFreeBond(BigNumber.from("5000"));
  }
};
