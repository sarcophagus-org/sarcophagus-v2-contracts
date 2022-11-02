import { Signature } from "ethers";

export enum VaultState {
  DoesNotExist,
  Exists,
  Done,
}

export interface SignatureWithAccount extends Signature {
  account: string;
}
