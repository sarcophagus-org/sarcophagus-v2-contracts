import { Contract, ContractReceipt } from "ethers";
import { ethers } from "hardhat";
import { DiamondCut, FacetCutAction } from "../types";

/**
 * Deploys the Sarcophagus facets and creates the diamond cuts needed for the
 * sarcophagus app facets
 *
 * @returns An array of diamond cuts
 */
const createAppDiamondCuts = async (): Promise<DiamondCut[]> => {
  // Deploy PrivateKeys library
  const LibPrivateKeys = await ethers.getContractFactory("LibPrivateKeys");
  const libPrivateKeys = await LibPrivateKeys.deploy();
  await libPrivateKeys.deployed();

  // Deploy Utils library
  const LibUtils = await ethers.getContractFactory("LibUtils");
  const libUtils = await LibUtils.deploy();
  await libUtils.deployed();

  // Deploy Sarcophaguses Facet
  // Functions used from other libraries are internal and thus do no need to be
  // deployed with the facet
  const SarcophagusesFacet = await ethers.getContractFactory(
    "SarcophagusesFacet",
    {
      libraries: {
        LibPrivateKeys: libPrivateKeys.address,
        LibUtils: libUtils.address,
      },
    }
  );
  const sarcophagusesFacet = await SarcophagusesFacet.deploy();
  await sarcophagusesFacet.deployed();

  // Deploy Archaeologists Facet
  // Functions used from other libraries are internal and thus do no need to be
  // deployed with the facet
  const ArchaeologistsFacet = await ethers.getContractFactory(
    "ArchaeologistsFacet",
    {
      libraries: {
        LibUtils: libUtils.address,
      },
    }
  );
  const archaeologistsFacet = await ArchaeologistsFacet.deploy();
  await archaeologistsFacet.deployed();

  return [
    {
      facetAddress: sarcophagusesFacet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(sarcophagusesFacet),
    },
    {
      facetAddress: archaeologistsFacet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(archaeologistsFacet),
    },
  ];
};

/**
 * Makes a diamond cut creating facets asynchronously
 *
 * @param cuts The cuts to be made to the diamond creating facets
 * @param diamondAddress The address of the diamond contract
 * @param functionCall The encoded data for the init function call from DiamondInit
 * @returns The transaction receipt
 */
const diamondCutAsync = async (
  cuts: DiamondCut[],
  diamondAddress: string,
  functionCall: string
): Promise<ContractReceipt> => {
  // Get the diamondCut contract
  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);

  // Make a diamond cut using the facets provided in cuts
  const diamondCutTx = await diamondCut.diamondCut(
    cuts,
    diamondAddress,
    functionCall
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

  // Deploy DiamondInit contract
  // DiamondInit provides a function that is called when the diamond is upgraded
  // to initialize state variables
  // Read about how the diamondCut function works here:
  // https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
  const DiamondInit = await ethers.getContractFactory("DiamondInit");
  const diamondInit = await DiamondInit.deploy();
  await diamondInit.deployed();

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

  // Encode the data for the init function call
  const functionCall = diamondInit.interface.encodeFunctionData("init");

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
    ...appCuts,
  ];

  // Make the diamond cut to create the facets provided in cuts
  try {
    await diamondCutAsync(cuts, diamond.address, functionCall);
    return diamond.address;
  } catch (error) {
    const _error = error as Error;
    throw new Error(_error.message);
  }
};