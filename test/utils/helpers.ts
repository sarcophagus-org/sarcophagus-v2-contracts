import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Signature } from "ethers";
import { ethers } from "hardhat";
import { SignatoryFacet, HeritageTokenMock, ViewStateFacet } from "../../typechain";
import { SignatureWithAccount } from "../types";
import { TestSignatory } from "../fixtures/spawn-signatories";

const flat = (data: string | string[]): string[] => {
  return data instanceof Array ? data : [data];
};

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
    // Sign a message and add to signatures. Only sign if the signatory
    // is not the arweave signatory
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
 * Gets a list of signatory heritageToken balances.
 *
 * @param signatories A list of signatory signers
 * @returns a list of signatory heritageToken balanaces
 */
export const getSignatoryVaultBalances = async (
  signatories: SignerWithAddress[],
  heritageToken: HeritageTokenMock
): Promise<{ address: string; balance: BigNumber }[]> => {
  const balances: { address: string; balance: BigNumber }[] = [];
  for (const signatory of signatories) {
    const balance = await heritageToken.balanceOf(signatory.address);
    balances.push({
      address: signatory.address,
      balance: balance,
    });
  }

  return balances;
};

export const toVault = (amount: number): BigNumber => {
  return BigNumber.from((amount * 10 ** 18).toString());
};

/**
 * Gets a list of signatory heritageToken rewards.
 *
 * @param signatories A list of signatory signers
 * @returns a list of signatory heritageToken rewards
 */
export const getSignatoryVaultRewards = async (
  signatories: SignerWithAddress[],
  viewStateFacet: ViewStateFacet
): Promise<{ address: string; reward: BigNumber }[]> => {
  const rewards: { address: string; reward: BigNumber }[] = [];
  for (const signatory of signatories) {
    const reward = await viewStateFacet.getRewards(signatory.address);
    rewards.push({
      address: signatory.address,
      reward: reward,
    });
  }

  return rewards;
};

// TODO: update if calculate cursed bond algorithm changes (or possibly this function will be removed)
export const calculateCursedBond = (diggingFee: BigNumber): BigNumber => diggingFee;

export const registerSignatory = async (
  signatory: TestSignatory,
  signatoryFacet: SignatoryFacet,
  minDiggingFee?: string,
  minRewrapInterval?: string,
  freeBond?: string,
  peerId?: string
): Promise<void> => {
  freeBond = freeBond || "0";
  minDiggingFee = minDiggingFee || "100";
  minRewrapInterval = minRewrapInterval || "10000";
  peerId = peerId || "myfakelibp2pPeerId";

  await signatoryFacet
    .connect(signatory.signer)
    .registerSignatory(
      peerId,
      BigNumber.from(minDiggingFee),
      BigNumber.from(minRewrapInterval),
      BigNumber.from(freeBond)
    );
};

export const updateSignatory = async (
  signatory: TestSignatory,
  signatoryFacet: SignatoryFacet,
  minDiggingFee: string,
  minRewrapInterval: string,
  freeBond?: string,
  peerId?: string
): Promise<void> => {
  await signatoryFacet
    .connect(signatory.signer)
    .updateSignatory(
      peerId || "myfakelibp2pPeerId",
      BigNumber.from(minDiggingFee),
      BigNumber.from(minRewrapInterval),
      BigNumber.from(freeBond || 0)
    );
};
