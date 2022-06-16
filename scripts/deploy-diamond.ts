import { Contract, ContractReceipt } from "ethers";
import { ethers } from "hardhat";
import { Diamond } from "../typechain";
import { DiamondCut, FacetCutAction } from "../types";

/**
 * Deploys the Sarcophagus facets and creates the diamond cuts needed for the
 * sarcophagus app facets
 *
 * @returns An array of diamond cuts
 */
const createAppDiamondCuts = async (): Promise<DiamondCut[]> => {
  // Deploy Utils library
  const LibUtils = await ethers.getContractFactory("LibUtils");
  const libUtils = await LibUtils.deploy();
  await libUtils.deployed();

  // Deploy Embalmer Facet
  // Functions used from other libraries are internal and thus do no need to be
  // deployed with the facet
  const EmbalmerFacet = await ethers.getContractFactory("EmbalmerFacet", {
    libraries: { LibUtils: libUtils.address },
  });
  const embalmerFacet = await EmbalmerFacet.deploy();
  await embalmerFacet.deployed();

  // Deploy Archaeologist Facet
  const ArchaeologistFacet = await ethers.getContractFactory(
    "ArchaeologistFacet"
  );
  const archaeologistFacet = await ArchaeologistFacet.deploy();
  await archaeologistFacet.deployed();

  return [
    {
      facetAddress: embalmerFacet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(embalmerFacet),
    },
    {
      facetAddress: archaeologistFacet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(archaeologistFacet),
    },
  ];
};

/**
 * Makes a diamond cut creating facets asynchronously
 *
 * @param diamondCuts The cuts to be made to the diamond creating facets
 * @param init The address making the cut
 * @param calldata The function selector of the function to be called after the
 * diamond cut
 * @param diamond The address of the diamond contract
 * @returns The transaction receipt
 */
const diamondCutAsync = async (
  diamondCuts: DiamondCut[],
  init: string,
  calldata: string,
  diamond: Diamond
): Promise<ContractReceipt> => {
  // Get the diamondCut interface contract
  const diamondCutContract = await ethers.getContractAt(
    "IDiamondCut",
    diamond.address
  );

  // Make a diamond cut using the facets provided in cuts
  const diamondCutTx = await diamondCutContract.diamondCut(
    diamondCuts,
    init,
    calldata
  );

  return new Promise((resolve, reject) => {
    diamondCutTx.wait().then((receipt) => {
      if (receipt.status && receipt.status === 1) {
        resolve(receipt);
      } else {
        reject(new Error(`Diamond upgrade failed: ${diamondCutTx.hash}`));
      }
    });
  });
};

/**
 * Get function selectors from a contract
 *
 * @param contract The contract
 * @returns An array of function selectors
 */
const getSelectors = (contract: Contract): string[] => {
  const signatures = Object.keys(contract.interface.functions);
  return signatures
    .filter((sig) => sig !== "init(bytes)")
    .map((sig) => contract.interface.getSighash(sig));
};

/**
 * Deploys the diamond contract
 *
 * @returns The diamond contract address
 */
export const deployDiamond = async () => {
  // Get all signers (or accounts)
  const accounts = await ethers.getSigners();

  // Get contract owner
  const contractOwner = accounts[0];

  // Deploy the mock sarco token
  const MockSarcoToken = await ethers.getContractFactory("SarcoTokenMock");
  const mockSarcoToken = await MockSarcoToken.deploy();
  await mockSarcoToken.deployed();

  // Deploy DiamondInit contract
  // DiamondInit provides a function that is called when the diamond is upgraded
  // to initialize state variables
  // Read about how the diamondCut function works here:
  // https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
  const DiamondInit = await ethers.getContractFactory("DiamondInit");
  const diamondInit = await DiamondInit.deploy();
  await diamondInit.deployed();

  // Deploy AppStorageInit contract
  const AppStorageInit = await ethers.getContractFactory("AppStorageInit");
  const appStorageInit = await AppStorageInit.deploy();
  await appStorageInit.deployed();

  // Deploy DiamondCutFacet contract
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.deployed();

  // Deploy the diamond
  const Diamond = await ethers.getContractFactory("Diamond");
  const diamond = await Diamond.deploy(
    contractOwner.address,
    diamondCutFacet.address
  );
  await diamond.deployed();

  // DiamondLoupe Facet
  const DiamondLoupeFacet = await ethers.getContractFactory(
    "DiamondLoupeFacet"
  );
  const diamondLoupeFacet = await DiamondLoupeFacet.deploy();
  await diamondLoupeFacet.deployed();

  // Ownership Facet
  const OwnershipFacet = await ethers.getContractFactory("OwnershipFacet");
  const ownershipFacet = await OwnershipFacet.deploy();
  await ownershipFacet.deployed();

  // Prepare cuts from each app specific facet for the diamond cut
  const appCuts: DiamondCut[] = await createAppDiamondCuts();

  // Combine the cuts needed for the diamond pattern to work with the cuts
  // needed for the app to work
  const cuts = [
    {
      facetAddress: diamondLoupeFacet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(diamondLoupeFacet),
    },
    {
      facetAddress: ownershipFacet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(ownershipFacet),
    },
  ];

  // Encode the data for the diamondInit init function call The
  // DiamondInit.init() function will be called with delegatecall after the
  // diamond cut for the diamond facets is performed
  const diamondInitCallData = diamondInit.interface.encodeFunctionData("init");

  // This adds the sarco token to AppStorage.
  //
  // Encode the data for appStorageInit init function call The
  // AppStorageInit.init() function will be called with delegatecall after the
  // diamond cut for the sarcophagus facets is performed.
  const appInitCallData = appStorageInit.interface.encodeFunctionData("init", [
    mockSarcoToken.address,
  ]);

  // Make the diamond cut to create the facets provided in cuts
  try {
    // Make the diamond cuts needed for the diamond pattern to work
    await diamondCutAsync(
      cuts,
      diamondInit.address,
      diamondInitCallData,
      diamond
    );

    // Make the diamond cuts for sarcophagus
    await diamondCutAsync(
      appCuts,
      appStorageInit.address,
      appInitCallData,
      diamond
    );
    return { diamondAddress: diamond.address, sarcoToken: mockSarcoToken };
  } catch (error) {
    const _error = error as Error;
    throw new Error(_error.message);
  }
};
