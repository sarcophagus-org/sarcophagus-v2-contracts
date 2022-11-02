import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { generateHistoryConfig } from "./config";
import { VaultData } from "./createVaults";

/**
 * Unwraps the provided list of vaults.
 * There are a number of reason why an unwrap may fail, some are legitimate, so the script will
 * continue if an error is thrown.
 * @param hre HardhatRuntimeEnvironment
 * @param signatorySigners Signers of the signatories
 * @param vaultsData Data of the vaults to dig
 */
export async function unwrapVaults(
  hre: HardhatRuntimeEnvironment,
  signatorySigners: SignerWithAddress[],
  vaultsData: VaultData[]
): Promise<void> {
  const signatoryUnwrapChance = generateHistoryConfig.signatoryUnwrapChance;
  const diamond = await hre.ethers.getContract("Diamond_DiamondProxy");
  const signatoryFacet = await hre.ethers.getContractAt("SignatoryFacet", diamond.address);
  const viewStateFacet = await hre.ethers.getContractAt("ViewStateFacet", diamond.address);

  console.log();
  console.log("Unwrapping vaults...");
  console.log(`Chance for each signatory to unwrap set to ${signatoryUnwrapChance * 100}%`);
  for (let i = 0; i < signatorySigners.length; i++) {
    const signatorySigner = signatorySigners[i];

    // Roll the dice to determine if this signatory will continue with the unwrap or not
    if (Math.random() >= signatoryUnwrapChance) {
      console.log(`Signatory ${signatorySigner.address} chose not to unwrap`);
      continue;
    }

    // Read this signatory's vaults from the contract
    const signatoriesVaults = await viewStateFacet.getSignatoryVaults(
      signatorySigner.address
    );

    // The signatory unwraps each vault they are on
    for (let j = 0; j < signatoriesVaults.length; j++) {
      const vaultId = signatoriesVaults[j];

      // Unwrap vault
      const vaultData = vaultsData.find(vault => vault.vaultId === vaultId);
      const signatoryUnencryptedShard =
        vaultData?.shards[signatorySigner.address] || "";
      try {
        await signatoryFacet
          .connect(signatorySigner)
          .unwrapVault(vaultId, signatoryUnencryptedShard);
        console.log(
          `Signatory ${signatorySigner.address} called unwrap with their shard for vault ${vaultId}`
        );
      } catch (_error) {
        const error = _error as Error;
        console.error(
          `Failed to unwrap vault ${vaultId} for signatory ${signatorySigner.address}`
        );
        // This could fail for a number of legitimate reasons, so we don't throw an error
        continue;
      }
    }
  }
}
