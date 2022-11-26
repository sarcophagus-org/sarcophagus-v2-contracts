import { Bytes } from "ethers";
import { BytesLike } from "ethers/lib/utils";

const { ethers } = require("hardhat");
const crypto = require("crypto");
const sss = require("shamirs-secret-sharing");

/**
 * Returns the hash of the supplied keyshare
 * */
export const hashShare = (share: BytesLike): string => {
  return ethers.utils.solidityKeccak256(["bytes"], [share]);
};

/**
 * Returns the double hash of the supplied keyshare
 * */
export const doubleHashShare = (share: Bytes): string => {
  return hashShare(hashShare(share));
};

/**
 * Generates a random 64 byte key
 * Splits the key into a set of n shares where a threshold of k is required to recover the original key
 * returns the array of shares and the original key as a hex string
 * */
export const generateKeyshares = (
  k: number,
  n: number
): { shares: Buffer[]; key: string } => {
  const secret = crypto.randomBytes(64);
  const shares: Buffer[] = sss.split(secret, { shares: n, threshold: k });
  return {
    shares,
    key: secret.toString("hex"),
  };
};
