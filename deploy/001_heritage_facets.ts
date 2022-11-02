import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  let heritageTokenAddress: string;

  const { deploy, diamond } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log('deployer: ', deployer)

  // Get the address of the HeritageToken contract
  if (
    hre.hardhatArguments.network === "develop" ||
    hre.hardhatArguments.network === "localhost" ||
    !hre.hardhatArguments.network
  ) {
    const heritageTokenMock = await deploy("HeritageTokenMock", {
      from: deployer,
      log: true,
    });
    heritageTokenAddress = heritageTokenMock.address;
  } else if (["goerli", "goerli-fork"].includes(hre.hardhatArguments.network)) {
    heritageTokenAddress = process.env.HERITAGE_TOKEN_ADDRESS_GOERLI || "";
  } else if (["mainnet", "mainnet-fork"].includes(hre.hardhatArguments.network)) {
    heritageTokenAddress = process.env.HERITAGE_TOKEN_ADDRESS_MAINNET || "";
  } else {
    throw Error(`Heritage is not set up for this network: ${hre.hardhatArguments.network}`);
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
      "VaultOwnerFacet",
      "SignatoryFacet",
      "ThirdPartyFacet",
      "ViewStateFacet",
      "AdminFacet",
    ],
    execute: {
      contract: "AppStorageInit",
      methodName: "init",
      args: [
        heritageTokenAddress,
        protocolFeeBasePercentage,
        gracePeriod,
        expirationThreshold
      ],
    },
    log: true,
  });
};

export default func;
