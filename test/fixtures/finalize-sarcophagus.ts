import { deployments } from "hardhat";
import { signMultiple } from "../utils/helpers";
import { getDeployedContracts } from "./get-deployed-contracts";
import { initializeSarcophagus } from "./initialize-sarcophagus";
import { setupArchaeologists } from "./setup-archaeologists";
import { setupArweaveArchSig } from "./setup-arweave-archaeologist-signature";

/**
 * A fixture to intialize and finalize a sarcophagus to set up a test that
 * requires a successful initialization and finalization. Not intended to be
 * used for the actual finalizeSarcophagus tests.
 */
export const finalizeSarcohpagus = deployments.createFixture(
  async ({
    deployments,
    getNamedAccounts,
    getUnnamedAccounts,
    ethers,
  }): Promise<string> => {
    // Deploy contracts
    await deployments.fixture();

    // Set up the archaeologists and initialize the sarcophagus
    const archaeologists = await setupArchaeologists();
    const { identifier } = await initializeSarcophagus();

    const { arweaveTxId, signatureWithAccount: arweaveArchSig } =
      await setupArweaveArchSig();

    // Get the embalmer facet
    const { embalmerFacet } = await getDeployedContracts();

    // Get signatures of the identifier from each archaeologist
    const signatures = await signMultiple(
      archaeologists.map((x) => x.signer),
      identifier
    );

    // Finalize the sarcophagus
    await embalmerFacet.finalizeSarcophagus(
      identifier,
      signatures,
      arweaveArchSig,
      arweaveTxId
    );

    return identifier;
  }
);
