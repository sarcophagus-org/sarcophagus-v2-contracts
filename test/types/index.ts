import { Signature } from "ethers";

export enum SarcophagusState {
  DoesNotExist,
  Active,
  Resurrecting,
  Resurrected,
  Buried,
  Cleaned,
  Accused,
}

export interface SignatureWithAccount extends Signature {
  account: string;
}
