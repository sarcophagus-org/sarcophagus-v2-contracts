import { deployments } from "hardhat";
import { SignatoryFacet, IERC20, ViewStateFacet } from "../../typechain";
import { TestSignatory } from "./spawn-signatories";
import { BigNumber } from "ethers";

/**
 * A fixture to simply deploy contracts and return a set number of
 * signatories with balances and approvals.
 *
 * Used when testing signatory functions that don't depend on
 * a vault.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const signatoriesFixture = (count: number) =>
  deployments.createFixture(
    async ({ deployments, getNamedAccounts, getUnnamedAccounts, ethers }) => {
      // Deploy contracts
      await deployments.fixture();

      // Get the entities interacting with the contracts
      const unnamedAccounts = await getUnnamedAccounts();

      const diamond = await ethers.getContract("Diamond_DiamondProxy");
      const heritageToken = await ethers.getContract("HeritageTokenMock");

      const signatoryFacet = await ethers.getContractAt("SignatoryFacet", diamond.address);
      const viewStateFacet = await ethers.getContractAt("ViewStateFacet", diamond.address);

      const signatories: TestSignatory[] = [];

      for (let i = unnamedAccounts.length - 1; i >= unnamedAccounts.length - count; i--) {
        const acc = await ethers.getSigner(unnamedAccounts[i]);

        signatories.push({
          signatoryAddress: acc.address,
          unencryptedShardDoubleHash: "",
          unencryptedShard: [],
          signer: acc,
          diggingFee: ethers.utils.parseEther("10"),
          v: BigNumber.from(0),
          r: "",
          s: "",
        });

        // Transfer 10,000 heritage tokens to each signatory to be put into free
        // bond, and approve spending
        await heritageToken.transfer(acc.address, ethers.utils.parseEther("10000"));

        await heritageToken.connect(acc).approve(diamond.address, ethers.constants.MaxUint256);
      }

      return {
        heritageToken: heritageToken as IERC20,
        signatoryFacet: signatoryFacet as SignatoryFacet,
        viewStateFacet: viewStateFacet as ViewStateFacet,
        signatories,
      };
    }
  )();
