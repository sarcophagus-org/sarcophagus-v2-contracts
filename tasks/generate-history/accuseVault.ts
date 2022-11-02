import { HardhatRuntimeEnvironment } from "hardhat/types";
import { generateHistoryConfig } from "./config";
import { VaultData } from "./createVault";

export async function accuseVault(
  hre: HardhatRuntimeEnvironment,
  vaultData: VaultData[]
): Promise<string[]> {
  // Get hre ethers tools
  const { getSigners } = hre.ethers;
  const { keccak256 } = hre.ethers.utils;
  const vaultToAccuse = generateHistoryConfig.accusedVaultCount;

  // Anyone can be an accuser, even if the accuser is an signatory on the vault
  const accuser = (await getSigners())[0];

  // Get the contracts
  const diamond = await hre.ethers.getContract("Diamond_DiamondProxy");
  const thirdPartyFacet = await hre.ethers.getContractAt("ThirdPartyFacet", diamond.address);
  const heritageToken = await hre.ethers.getContract("HeritageTokenMock");

  // Pick random vault to accuse
  // Shuffle and slice
  const accusedVault = vaultData
    .sort(() => 0.5 - Math.random())
    .slice(0, vaultToAccuse);

  console.log();
  console.log("Accusing signatorys on vault...");
  for (let i = 0; i < vaultToAccuse; i++) {
    const { vaultId, shards } = accusedVault[i];
    const unencryptedShardHashes = Object.values(shards).map(shard => keccak256(shard));
    try {
      await thirdPartyFacet
        .connect(accuser)
        .accuse(vaultId, unencryptedShardHashes, accuser.address);
      console.log(`(${i + 1}/${vaultToAccuse}) Accused all signatories on ${vaultId}`);
    } catch (_error) {
      const error = _error as Error;
      console.log(`(${i + 1}/${vaultToAccuse}) Failed to accuse signatories on ${vaultId}`);
      throw new Error(error.message);
    }
  }

  return accusedVault.map(vault => vault.vaultId);
}
