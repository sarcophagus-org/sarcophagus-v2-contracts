import { getContractFactory } from "@nomiclabs/hardhat-ethers/types";
import { BigNumber, ContractTransaction } from "ethers";
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
  }): Promise<{ identifier: string; tx: ContractTransaction }> => {
    // Deploy contracts
    await deployments.fixture();

    // Get the entities interacting with the contracts
    const { embalmer, recipient } = await getSigners();

    const diamond = await ethers.getContract("Diamond_DiamondProxy");
    const sarcoToken = await ethers.getContract("SarcoTokenMock");

    // Transfer 10,000 sarco tokens to each archaeologist to be put into free
    // bond
    await sarcoToken.transfer(embalmer.address, BigNumber.from(10_000));

    // Approve the archaeologist on the sarco token so transferFrom will work
    await sarcoToken
      .connect(embalmer)
      .approve(diamond.address, ethers.constants.MaxUint256);

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
      Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    );
    const minShards = 2;

    // Create a sarcophagus as the embalmer
    const tx = await embalmerFacet
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

    return { identifier, tx };
  }
);
