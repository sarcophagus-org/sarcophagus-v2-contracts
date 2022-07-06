import { BigNumber } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { deployments } from "hardhat";
import { getDeployedContracts } from "./get-deployed-contracts";
import { getSigners } from "./get-signers";
import { setupArchaeologists } from "./setup-archaeologists";

/**
 * A fixture to initialize the sarcophagus to set up a test that reqiures a
 * successful initialization. Not intended to be used for the actual
 * intializeSarcophagus tests.
 */
export const initializeSarcophagus = deployments.createFixture(
  async ({
    deployments,
    getNamedAccounts,
    getUnnamedAccounts,
    ethers,
  }): Promise<string> => {
    // Deploy contracts
    await deployments.fixture();

    // Get the entities interacting with the contracts
    const { embalmer, recipient } = await getSigners();

    // Get the embalmer facet
    const { embalmerFacet } = await getDeployedContracts();

    // Set up the data for the sarcophagus
    const name = "Test Sarcophagus";
    const identifier = solidityKeccak256(["string"], ["unhashedIdentifier"]);
    const archaeologists = await setupArchaeologists();
    const arweaveArchaeologist = archaeologists[0];
    const canBeTransferred = true;
    // 1 week
    const resurrectionTime = BigNumber.from(
      Date.now() / 1000 + 60 * 60 * 24 * 7
    );
    const minShards = 2;

    // Create a sarcophagus as the embalmer
    await embalmerFacet
      .connect(embalmer)
      .initializeSarcophagus(
        name,
        identifier,
        archaeologists,
        arweaveArchaeologist.account,
        recipient.address,
        resurrectionTime,
        canBeTransferred,
        minShards
      );

    return identifier;
  }
);
