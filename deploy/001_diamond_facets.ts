import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  let sarcoTokenAddress: string;
  const { deploy, diamond } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  // Deploy a diamond and run diamond init
  await diamond.deploy("Diamond", {
    from: deployer,
    owner: deployer,
    facets: [],
    execute: {
      contract: "DiamondInit",
      methodName: "init",
      args: [],
    },
    log: true,
  });
};

export default func;
