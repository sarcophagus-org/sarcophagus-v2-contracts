import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract, Signature } from "ethers";

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
  hashedShard: string;
}

export interface SignatureWithAccount extends Signature {
  account: string;
}

export interface DeployedContracts {
  diamond: Contract;
  sarcoToken: Contract;
  embalmerFacet: Contract;
  archaeologistFacet: Contract;
}
