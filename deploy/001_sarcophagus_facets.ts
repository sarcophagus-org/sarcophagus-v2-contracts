import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
  let sarcoTokenAddress: string;
  let cursesAddress: string;

  const { deploy, diamond } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  // Get the address of the SarcoToken contract
  if (hre.hardhatArguments.network === "develop" || !hre.hardhatArguments.network) {
    const sarcoTokenMock = await deploy("SarcoTokenMock", {
      from: deployer,
      log: true
    });
    sarcoTokenAddress = sarcoTokenMock.address;
    const cursesMock = await deploy("CursesMock", {
      from: deployer,
      log: true
    });
    cursesAddress = cursesMock.address;
  } else if (["goerli", "goerli-fork"].includes(hre.hardhatArguments.network)) {
    sarcoTokenAddress = process.env.SARCO_TOKEN_ADDRESS_GOERLI || "";
    cursesAddress = process.env.CURSES_ADDRESS_GOERLI || "";
  } else if (["mainnet", "mainnet-fork"].includes(hre.hardhatArguments.network)) {
    sarcoTokenAddress = process.env.SARCO_TOKEN_ADDRESS_MAINNET || "";
    cursesAddress = process.env.CURSES_ADDRESS_MAINNET || "";
  } else {
    throw Error(`Sarcophagus is not set up for this network: ${hre.hardhatArguments.network}`);
  }

  // Deploy the facets. Note that running diamond.deploy again will not redeploy
  // the diamond. It will reuse the diamond contracts that have already been
  // deployed.
  // The only reason for doing diamond.deploy again is to execute
  // AppStorageInit. This is pretty much just a convenience.
  // Protocol fee defaults to 1% (100bps)
  const protocolFeeBasePercentage = process.env.PROTOCOL_FEE_BASE_PERCENTAGE || "1";
  const gracePeriod = process.env.GRACE_PERIOD_SECONDS || "3600";
  const expirationThreshold = process.env.EXPIRATION_THRESHOLD_SECONDS || "3600";

  await diamond.deploy("Diamond", {
    from: deployer,
    owner: deployer,
    facets: [
      "EmbalmerFacet",
      "ArchaeologistFacet",
      "ThirdPartyFacet",
      "ViewStateFacet",
      "AdminFacet"
    ],
    execute: {
      contract: "AppStorageInit",
      methodName: "init",
      args: [sarcoTokenAddress, protocolFeeBasePercentage, gracePeriod, expirationThreshold, cursesAddress]
    },
    log: true
  });
};

export default func;
