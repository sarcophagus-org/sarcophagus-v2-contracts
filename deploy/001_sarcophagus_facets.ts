import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import time from "../test/utils/time";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  let sarcoTokenAddress: string;

  const { deploy, diamond } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  // Get the address of the SarcoToken contract
  if (
    hre.hardhatArguments.network === "develop" ||
    hre.hardhatArguments.network === "localhost" ||
    !hre.hardhatArguments.network
  ) {
    const sarcoTokenMock = await deploy("SarcoTokenMock", {
      from: deployer,
      log: true,
    });
    sarcoTokenAddress = sarcoTokenMock.address;
  } else if (["goerli", "goerli-fork"].includes(hre.hardhatArguments.network)) {
    sarcoTokenAddress = "0x4633b43990b41B57b3678c6F3Ac35bA75C3D8436";
  } else if (["sepolia"].includes(hre.hardhatArguments.network)) {
    sarcoTokenAddress = "0xfa1FA4d51FB2babf59e402c83327Ab5087441289";
  } else if (
    ["mainnet", "mainnet-fork"].includes(hre.hardhatArguments.network)
  ) {
    sarcoTokenAddress = "0x7697b462a7c4ff5f8b55bdbc2f4076c2af9cf51a";
  } else {
    throw Error(
      `Sarcophagus is not set up for this network: ${hre.hardhatArguments.network}`
    );
  }

  // Default: 1% (100 / 10000)
  const protocolFeeBasePercentage =
    process.env.PROTOCOL_FEE_BASE_PERCENTAGE || "100";

  // Default: 100% (10000 / 10000)
  const cursedBondPercentage = process.env.CURSED_BOND_PERCENTAGE || "10000";

  // Default: 1 Day
  const gracePeriod = process.env.GRACE_PERIOD_SECONDS || time.duration.days(1);

  // Default 1 week
  const embalmerClaimWindow =
    process.env.EMBALMER_CLAIM_WINDOW_SECONDS || time.duration.weeks(1);

  // Default 1 hour
  const expirationThreshold =
    process.env.EXPIRATION_THRESHOLD_SECONDS || time.duration.hours(1);

  // TODO: This will most likely be the aragon agent, but verify
  const admin = process.env.ADMIN_ADDRESS || deployer;

  await diamond.deploy("Sarcophagus_V2", {
    from: deployer,
    owner: deployer,
    facets: [
      "EmbalmerFacet",
      "ArchaeologistFacet",
      "ThirdPartyFacet",
      "ViewStateFacet",
      "AdminFacet",
    ],
    execute: {
      contract: "AppStorageInit",
      methodName: "init",
      args: [
        sarcoTokenAddress,
        admin,
        protocolFeeBasePercentage,
        cursedBondPercentage,
        gracePeriod,
        embalmerClaimWindow,
        expirationThreshold,
      ],
    },
    log: true,
  });
};

export default func;
