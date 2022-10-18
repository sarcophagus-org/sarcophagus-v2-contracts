// Transfer 10,000 sarco tokens to an address
// transferAddress defaults to the first unnamed hardhat local node account
const amountToTransfer = "10000000000000000000000";
const mockTokenAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

const hre = require("hardhat");

// Add supported networks to this list on a need basis
const allowedNetworks = ["localhost"];

(async () => {
  if (!allowedNetworks.includes(hre.hardhatArguments.network)) {
    throw new Error(
      `Transfer script is meant to be used on these networks only:\n${allowedNetworks}\n`
    );
  }

  const sarcoToken = await hre.ethers.getContractAt("SarcoTokenMock", mockTokenAddress);
  const unsignedAccounts = await hre.getUnnamedAccounts();

  const transferAddress = process.env.TRANSFER_ADDRESS || unsignedAccounts[0];

  await sarcoToken.transfer(transferAddress, hre.ethers.BigNumber.from(amountToTransfer));

  const newBalance = await sarcoToken.balanceOf(transferAddress);
  console.log("account balance:", newBalance.toString());
})();
