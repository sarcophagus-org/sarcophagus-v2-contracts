import { Signature } from "ethers";

export enum SarcophagusState {
  DoesNotExist,
  Exists,
  Done,
}


export interface SignatureWithAccount extends Signature {
  account: string;
}
