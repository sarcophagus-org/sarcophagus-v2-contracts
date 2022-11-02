import { HardhatRuntimeEnvironment } from "hardhat/types";
import { accuseVault } from "./accuseVault";
import { createVaults } from "./createVaults";
import { increaseTo } from "./helpers";
import { registerSignatories } from "./registerSignatories";
import { unwrapVaults } from "./unwrapVaults";

export interface GenerateHistoryTaskArgs {
  signatoryCount: string;
  vaultCount: string;
  accusedVaultCount: string;
  signatoryUnwrapChance: string;
}

/**
 * Generates fake historical data for the hardhat `generate-history` task.
 */
export async function generateHistory(
  taskArgs: GenerateHistoryTaskArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  if (hre.network.name !== "localhost") {
    throw new Error(
      "The generate-history task was intended to be run on localhost only. Please run it with `--network localhost`."
    );
  }

  // Set for an adequate time in the future
  const vaultLifeTime = 10_000;
  const resurrectionTime = Math.floor(Date.now() / 1000) + vaultLifeTime;

  // Register some signatories
  const signatorySigners = await registerSignatories(hre);

  // Create some vaults
  const vaultsData = await createVaults(hre, signatorySigners, resurrectionTime);

  // Accuse the signatories on some vaults
  const accusedVaults = await accuseVault(hre, vaultsData);

  // Adjust block timestamp so that unwrap will succeed
  // NOTE: This will cause unwrap to only work once. Running this command a second time requires the
  // local chain to be restarted.
  await increaseTo(hre, resurrectionTime + 100);

  // Filter out the accuased vaults for unwrapping
  const unaccusedVaultsData = vaultsData.filter(
    sarcophagus => !accusedVaults.includes(sarcophagus.sarcoId)
  );

  // Unwrap some sarcohpagi
  await unwrapVaults(hre, signatorySigners, unaccusedVaultsData);
}
