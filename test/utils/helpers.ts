import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Signature } from "ethers";
import { ethers } from "hardhat";
import { ArchaeologistFacet, SarcoTokenMock, ViewStateFacet } from "../../typechain";
import { SignatureWithAccount } from "../../types";
import { TestArchaeologist } from "../fixtures/spawn-archaeologists";

const flat = (data: string | string[]): string[] => {
  return data instanceof Array ? data : [data]
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
export async function sign(
  signer: SignerWithAddress,
  message: string | string[],
  type: string | string[]
): Promise<Signature> {
  const dataHex = ethers.utils.defaultAbiCoder.encode(flat(type), flat(message));
  const dataHash = ethers.utils.keccak256(dataHex);
  const dataHashBytes = ethers.utils.arrayify(dataHash);
  const signature = await signer.signMessage(dataHashBytes);
  return ethers.utils.splitSignature(signature);
}

/**
 * Signs a message given an array of signers and a single message
 *
 * @param signers An array of signers
 * @param message The message
 * @returns The signatures with the accounts that signed them
 */
export async function signMultiple(
  signers: SignerWithAddress[],
  message: string
): Promise<SignatureWithAccount[]> {
  const signatures: SignatureWithAccount[] = [];

  for (const signer of signers) {
    // Sign a message and add to signatures. Only sign if the archaeologist
    // is not the arweave archaeologist
    const signature = await sign(signer, message, "bytes32");

    signatures.push(Object.assign(signature, { account: signer.address }));
  }

  return signatures;
}

/**
 * Increase the timestamp of the next block by a given number of seconds.
 *
 * @param sec The number of seconds to increase the next block by
 */
export const increaseNextBlockTimestamp = async (sec: number): Promise<void> => {
  await ethers.provider.send("evm_setNextBlockTimestamp", [
    (await ethers.provider.getBlock("latest")).timestamp + sec,
  ]);
};

/**
 * Gets a list of archaeologist sarco balances.
 *
 * @param archaeologists A list of archaeologist signers
 * @returns a list of archaeologist sarco balanaces
 */
export const getArchaeologistSarcoBalances = async (
  archaeologists: SignerWithAddress[],
  sarcoToken: SarcoTokenMock
): Promise<{ address: string; balance: BigNumber }[]> => {
  const balances: { address: string; balance: BigNumber }[] = [];
  for (const arch of archaeologists) {
    const balance = await sarcoToken.balanceOf(arch.address);
    balances.push({
      address: arch.address,
      balance: balance,
    });
  }

  return balances;
};

/**
 * Gets a list of archaeologist sarco rewards.
 *
 * @param archaeologists A list of archaeologist signers
 * @returns a list of archaeologist sarco rewards
 */
export const getArchaeologistSarcoRewards = async (
  archaeologists: SignerWithAddress[],
  viewStateFacet: ViewStateFacet
): Promise<{ address: string; reward: BigNumber }[]> => {
  const rewards: { address: string; reward: BigNumber }[] = [];
  for (const arch of archaeologists) {
    const reward = await viewStateFacet.getRewards(arch.address);
    rewards.push({
      address: arch.address,
      reward: reward,
    });
  }

  return rewards;
};

// TODO: update if calculate cursed bond algorithm changes (or possibly this function will be removed)
export const calculateCursedBond = (diggingFee: BigNumber): BigNumber =>
  diggingFee;

export const getAttributeFromURI = (uri: string, attributeName: string): number => {
  const uriPrefix = "data:application/json;base64,";
  const base64Uri = uri.replace(uriPrefix, "");
  const decodedUri = Buffer.from(base64Uri, "base64").toString("utf8");
  const nftMetadata = JSON.parse(decodedUri);
  const resurrectionTime = nftMetadata.attributes.find(
    (x: any) => x.trait_type === attributeName
  ).value;
  return parseInt(resurrectionTime);
};

export const registerArchaeologist = async (
  archaeologist: TestArchaeologist,
  archaeologistFacet: ArchaeologistFacet,
  minDiggingFee?: string,
  minRewrapInterval?: string,
  freeBond?: string,
  peerId?: string
): Promise<void> => {
  freeBond = freeBond || "0";
  minDiggingFee = minDiggingFee || "100";
  minRewrapInterval = minRewrapInterval || "10000";
  peerId = peerId || "myfakelibp2pPeerId"

  await archaeologistFacet
    .connect(archaeologist.signer)
    .registerArchaeologist(
      peerId,
      BigNumber.from(minDiggingFee),
      BigNumber.from(minRewrapInterval),
      BigNumber.from(freeBond)
    );
}

export const updateArchaeologist = async (
  archaeologist: TestArchaeologist,
  archaeologistFacet: ArchaeologistFacet,
  minDiggingFee: string,
  minRewrapInterval: string,
  freeBond?: string,
  peerId?: string
): Promise<void> => {
  await archaeologistFacet
    .connect(archaeologist.signer)
    .updateArchaeologist(
      peerId || "myfakelibp2pPeerId",
      BigNumber.from(minDiggingFee),
      BigNumber.from(minRewrapInterval),
      BigNumber.from(freeBond || 0)
    );
}