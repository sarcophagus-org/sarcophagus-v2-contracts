import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getContracts } from "./contracts";
import { BigNumber } from "ethers";

const { ethers } = require("hardhat");

/**
 * Transfers the supplied amount of whole SARCO to the supplied account
 * Approves the diamond contract to spend any amount of SARCO on behalf of the account
 * @param account
 * @param amountSarco
 */
export const fundAndApproveAccount = async (
  account: SignerWithAddress,
  amountSarco: number
): Promise<void> => {
  const { sarcoToken, diamond } = await getContracts();
  // convert qty to number of quintillionths of a SARCO
  const sarquitos = ethers.utils.parseEther(amountSarco.toString());
  await sarcoToken.transfer(account.address, sarquitos);
  await sarcoToken
    .connect(account)
    .approve(diamond.address, ethers.constants.MaxUint256);
};

export const getSarquitoBalance = async (address: string): Promise<BigNumber> =>
  await (await getContracts()).sarcoToken.balanceOf(address);
