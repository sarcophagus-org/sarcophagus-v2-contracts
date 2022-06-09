export enum FacetCutAction {
  Add,
}

export interface DiamondCut {
  facetAddress: string;
  action: FacetCutAction;
  functionSelectors: string[];
}
