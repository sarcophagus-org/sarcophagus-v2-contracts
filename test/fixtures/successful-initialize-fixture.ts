import { BigNumber, ContractTransaction } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { deployments } from "hardhat";
import { ArchaeologistFacet } from "../../typechain";
import time from "../utils/time";
import { setupArchaeologists } from "./setup-archaeologists";

/**
 * A fixture to initialize the sarcophagus to set up a test that reqiures a
 * successful initialization. Not intended to be used for the actual
 * intializeSarcophagus tests.
 */
export const successfulInitializeFixture = deployments.createFixture(
  async ({ deployments, getNamedAccounts, getUnnamedAccounts, ethers }) => {
    // Deploy contracts
    await deployments.fixture();

    // Get the entities interacting with the contracts
    const unnamedAccounts = await getUnnamedAccounts();
    const embalmer = await ethers.getSigner(unnamedAccounts[0]);
    const recipient = await ethers.getSigner(unnamedAccounts[1]);

    const diamond = await ethers.getContract("Diamond_DiamondProxy");
    const sarcoToken = await ethers.getContract("SarcoTokenMock");
    const embalmerFacet = await ethers.getContractAt("EmbalmerFacet", diamond.address);
    const archaeologistFacet = await ethers.getContractAt("ArchaeologistFacet", diamond.address);

    // Transfer 10,000 sarco tokens to embalmer
    await sarcoToken.transfer(embalmer.address, BigNumber.from(10_000));

    // Approve the embalmer on the sarco token so transferFrom will work
    await sarcoToken.connect(embalmer).approve(diamond.address, ethers.constants.MaxUint256);

    // Set up the data for the sarcophagus
    const name = "Test Sarcophagus";
    const sarcoId = solidityKeccak256(["string"], ["unhashedIdentifier"]);
    const archaeologists = await setupArchaeologists();
    const arweaveArchaeologist = archaeologists[0];
    const canBeTransferred = true;

    // 1 week
    const resurrectionTime = (await time.latest()) + time.duration.weeks(1);
    const minShards = 2;

    const embalmerBalance = await sarcoToken.balanceOf(embalmer.address);

    // Create a sarcophagus as the embalmer
    const tx: ContractTransaction = await embalmerFacet
      .connect(embalmer)
      .initializeSarcophagus(
        name,
        sarcoId,
        archaeologists,
        arweaveArchaeologist.account,
        recipient.address,
        resurrectionTime,
        canBeTransferred,
        minShards
      );

    return {
      sarcoId,
      tx,
      sarcoToken,
      embalmer,
      archaeologists,
      arweaveArchaeologist,
      embalmerBalance,
      embalmerFacet,
      archaeologistFacet: archaeologistFacet as ArchaeologistFacet,
    };
  }
);
