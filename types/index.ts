import { BigNumber, Signature } from "ethers";

export enum FacetCutAction {
  Add,
}

export enum SarcophagusState {
  DoesNotExist,
  Exists,
  Done,
}

export interface DiamondCut {
  facetAddress: string;
  action: FacetCutAction;
  functionSelectors: string[];
}

export interface Archaeologist {
  archAddress: string;
  storageFee: BigNumber;
  diggingFee: BigNumber;
  bounty: BigNumber;
  hashedShard: string;
}

export interface SignatureWithAccount extends Signature {
  account: string;
}

export interface FixtureArchaeologist {
  account: string;
  // TODO: If archAddress changes to account in contract, remove archAddress from this type
  archAddress: string; // same as account, contract expects archAddress
  signer: SignerWithAddress;
  bounty: BigNumber;
  diggingFee: BigNumber;
  storageFee: BigNumber;
  hashedShard: string;
  signature?: Signature;
}
