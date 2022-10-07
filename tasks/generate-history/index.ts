import { HardhatRuntimeEnvironment } from "hardhat/types";
import { accuseSarcophagus } from "./accuseSarcophagus";
import { createSarcophagi } from "./createSarcophagi";
import { increaseTo } from "./helpers";
import { registerArchaeologists } from "./registerArchaeologists";
import { unwrapSarcophagi } from "./unwrapSarcophagi";

export interface GenerateHistoryTaskArgs {
  archaeologistCount: string;
  sarcophagusCount: string;
  accusedSarcophagusCount: string;
  archaeologistUnwrapChance: string;
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
  const sarcophagusLifeTime = 10_000;
  const resurrectionTime = Math.floor(Date.now() / 1000) + sarcophagusLifeTime;

  // Register some archaeologists
  const archaeologistSigners = await registerArchaeologists(hre);

  // Create some sarcophagi
  const sarcophagiData = await createSarcophagi(hre, archaeologistSigners, resurrectionTime);

  // Accuse the archaeologists on some sarcophagi
  const accusedSarcophagi = await accuseSarcophagus(hre, sarcophagiData);

  // Adjust block timestamp so that unwrap will succeed
  // NOTE: This will cause unwrap to only work once. Running this command a second time requires the
  // local chain to be restarted.
  await increaseTo(hre, resurrectionTime + 100);

  // Filter out the accuased sarcophagi for unwrapping
  const unaccusedSarcophagiData = sarcophagiData.filter(
    sarcophagus => !accusedSarcophagi.includes(sarcophagus.sarcoId)
  );

  // Unwrap some sarcohpagi
  await unwrapSarcophagi(hre, archaeologistSigners, unaccusedSarcophagiData);
}
