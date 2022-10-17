// Transfer 10,000 sarco tokens to the an address
// transferAddress defaults to the embalmer address the webapp uses
const amountToTransfer = "10000000000000000000000";
const transferAddress =
  process.env.TRANSFER_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const hre = require("hardhat");

(async () => {
  const sarcoToken = await hre.ethers.getContractAt("SarcoTokenMock", transferAddress);
  const unsignedAccounts = await hre.getUnnamedAccounts();
  await sarcoToken.transfer(unsignedAccounts[0], hre.ethers.BigNumber.from(amountToTransfer));

  const newBalance = await sarcoToken.balanceOf(unsignedAccounts[0]);
  console.log("embalmer balance:", newBalance.toString());
})();
