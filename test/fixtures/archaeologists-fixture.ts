import { deployments } from "hardhat";
import { ArchaeologistFacet, IERC20, ViewStateFacet } from "../../typechain";
import { TestArchaeologist } from "./spawn-archaeologists";
import { BigNumber } from "ethers";

/**
 * A fixture to simply deploy contracts and return a set number of
 * archaeologists with balances and approvals.
 *
 * Used when testing archaeologist functions that don't depend on
 * a sarcophagus.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const archeologistsFixture = (count: number) =>
  deployments.createFixture(
    async ({ deployments, getNamedAccounts, getUnnamedAccounts, ethers }) => {
      // Deploy contracts
      await deployments.fixture();

      // Get the entities interacting with the contracts
      const unnamedAccounts = await getUnnamedAccounts();

      const diamond = await ethers.getContract("Diamond_DiamondProxy");
      const sarcoToken = await ethers.getContract("SarcoTokenMock");

      const archaeologistFacet = await ethers.getContractAt("ArchaeologistFacet", diamond.address);
      const viewStateFacet = await ethers.getContractAt("ViewStateFacet", diamond.address);

      const archaeologists: TestArchaeologist[] = [];

      for (let i = unnamedAccounts.length - 1; i >= unnamedAccounts.length - count; i--) {
        const acc = await ethers.getSigner(unnamedAccounts[i]);

        archaeologists.push({
          archAddress: acc.address,
          unencryptedShardDoubleHash: "",
          unencryptedShard: [],
          signer: acc,
          diggingFee: ethers.utils.parseEther("10"),
          v: BigNumber.from(0),
          r: "",
          s: "",
        });

        // Transfer 10,000 sarco tokens to each archaeologist to be put into free
        // bond, and approve spending
        await sarcoToken.transfer(acc.address, ethers.utils.parseEther("10000"));

        await sarcoToken.connect(acc).approve(diamond.address, ethers.constants.MaxUint256);
      }

      return {
        sarcoToken: sarcoToken as IERC20,
        archaeologistFacet: archaeologistFacet as ArchaeologistFacet,
        viewStateFacet: viewStateFacet as ViewStateFacet,
        archaeologists,
      };
    }
  )();
