import { Bytes } from "ethers";
import { BytesLike } from "ethers/lib/utils";

const { ethers } = require("hardhat");
const crypto = require("crypto");
const sss = require("shamirs-secret-sharing");

/**
 * hashes the key share once
 * @param share
 */
export const hashShare = (share: BytesLike): string => {
  return ethers.utils.solidityKeccak256(["bytes"], [share]);
};

/**
 * hashes the key share twice
 * @param share
 */
export const doubleHashShare = (share: Bytes): string => {
  return hashShare(hashShare(share));
};

/**
 * Generates a random 64 byte key
 * Splits the key into a set of n shares where a threshold of k is required to recover the original key
 * returns the array of shares and the original key as a hex string
 * @param k the threshold of shares required to reconstruct the key
 * @param n the total number of shares to create from the key
 */
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
