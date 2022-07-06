import { BigNumber } from "ethers";
import { deployments } from "hardhat";
import { getDeployedContracts } from "./get-deployed-contracts";
import { setupArchaeologists } from "./setup-archaeologists";

export const coreSetup = deployments.createFixture(
  async ({ deployments, getNamedAccounts, getUnnamedAccounts, ethers }) => {
    await deployments.fixture();
    const unnamedAccounts = await getUnnamedAccounts();
    const embalmer = await ethers.getSigner(unnamedAccounts[0]);
    const recipient = await ethers.getSigner(unnamedAccounts[1]);

    const { diamond, sarcoToken, archaeologistFacet } =
      await getDeployedContracts();

    // Set up the archaeologists
    const archaeologists = await setupArchaeologists();

    // Approve the embalmer on the sarco token so transferFrom will work
    await sarcoToken
      .connect(embalmer)
      .approve(diamond.address, ethers.constants.MaxUint256);

    for (const archaeologist of archaeologists) {
      // Transfer 10,000 sarco tokens to each archaeologist to be put into free
      // bond
      await sarcoToken.transfer(archaeologist.account, BigNumber.from(10_000));

      // Approve the archaeologist on the sarco token so transferFrom will work
      await sarcoToken
        .connect(archaeologist.signer)
        .approve(diamond.address, ethers.constants.MaxUint256);

      // Deposit some free bond to the contract so initializeSarcophagus will
      // work
      await archaeologistFacet
        .connect(archaeologist.signer)
        .depositFreeBond(BigNumber.from("1000"));
    }

    return {
      embalmer,
      recipient,
      archaeologists,
    };
  }
);
