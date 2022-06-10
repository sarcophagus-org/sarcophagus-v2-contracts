import { BigNumber } from "ethers";

export enum FacetCutAction {
  Add,
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
