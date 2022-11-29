import { Signature } from "ethers";

export interface SignatureWithAccount extends Signature {
  account: string;
}
