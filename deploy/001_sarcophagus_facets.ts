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
    sarcoTokenAddress = process.env.SARCO_TOKEN_ADDRESS_GOERLI || "";
  } else if (["sepolia"].includes(hre.hardhatArguments.network)) {
    sarcoTokenAddress = process.env.SARCO_TOKEN_ADDRESS_SEPOLIA || "";
  } else if (
    ["mainnet", "mainnet-fork"].includes(hre.hardhatArguments.network)
  ) {
    sarcoTokenAddress = process.env.SARCO_TOKEN_ADDRESS_MAINNET || "";
  } else {
    throw Error(
      `Sarcophagus is not set up for this network: ${hre.hardhatArguments.network}`
    );
  }

  // TODO: set actual defaults prior to mainnet deployment
  const protocolFeeBasePercentage =
    process.env.PROTOCOL_FEE_BASE_PERCENTAGE || "1";
  const cursedBondPercentage = process.env.CURSED_BOND_PERCENTAGE || "100";
  const gracePeriod = process.env.GRACE_PERIOD_SECONDS || "3600";
  const embalmerClaimWindow =
    process.env.EMBALMER_CLAIM_WINDOW_SECONDS || time.duration.weeks(1);
  const expirationThreshold =
    process.env.EXPIRATION_THRESHOLD_SECONDS || "3600";

  // TODO: This will most likely be the aragon agent, but verify
  const admin = process.env.ADMIN_ADDRESS || deployer;

  await diamond.deploy("SarcophagusGoerliV2", {
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
