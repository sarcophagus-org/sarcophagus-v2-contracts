import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ArchaeologistFacet, ViewStateFacet } from "../../typechain";
import { generateHistoryConfig } from "./config";
import { SarcophagusData } from "./createSarcophagi";

/**
 * Unwraps the provided list of sarcophagi.
 * There are a number of reason why an unwrap may fail, some are legitimate, so the script will
 * continue if an error is thrown.
 * @param hre HardhatRuntimeEnvironment
 * @param archaeologistSigners Signers of the archaeologists
 * @param sarcophagiData Data of the sarcophagi to dig
 */
export async function unwrapSarcophagi(
  hre: HardhatRuntimeEnvironment,
  archaeologistSigners: SignerWithAddress[],
  sarcophagiData: SarcophagusData[]
): Promise<void> {
  const archaeologistUnwrapChance = generateHistoryConfig.archaeologistUnwrapChance;
  const diamond = await hre.ethers.getContract("Diamond_DiamondProxy");
  const archaeologistFacet: ArchaeologistFacet = await hre.ethers.getContractAt(
    "ArchaeologistFacet",
    diamond.address
  );
  const viewStateFacet: ViewStateFacet = await hre.ethers.getContractAt(
    "ViewStateFacet",
    diamond.address
  );

  console.log();
  console.log("Unwrapping sarcophagi...");
  console.log(`Chance for each archaeologist to unwrap set to ${archaeologistUnwrapChance * 100}%`);
  for (let i = 0; i < archaeologistSigners.length; i++) {
    const archaeologistSigner = archaeologistSigners[i];

    // Roll the dice to determine if this archaeologist will continue with the unwrap or not
    if (Math.random() >= archaeologistUnwrapChance) {
      console.log(`Archaeologist ${archaeologistSigner.address} chose not to unwrap`);
      continue;
    }

    // Read this archaeologist's sarcophagi from the contract
    const archaeologistsSarcophagi = await viewStateFacet.getArchaeologistSarcophagi(
      archaeologistSigner.address
    );

    // The archaeologist unwraps each sarcophagus they are on
    for (let j = 0; j < archaeologistsSarcophagi.length; j++) {
      const sarcoId = archaeologistsSarcophagi[j];

      // Unwrap sarcophagus
      const sarcophagusData = sarcophagiData.find(sarcophagus => sarcophagus.sarcoId === sarcoId);
      const archaeologistUnencryptedShard =
        sarcophagusData?.shards[archaeologistSigner.address] || "";
      try {
        await archaeologistFacet
          .connect(archaeologistSigner)
          .unwrapSarcophagus(sarcoId, archaeologistUnencryptedShard);
        console.log(
          `Archaeologist ${archaeologistSigner.address} called unwrap with their shard for sarcophagus ${sarcoId}`
        );
      } catch (_error) {
        const error = _error as Error;
        console.error(
          `Failed to unwrap sarcophagus ${sarcoId} for archaeologist ${archaeologistSigner.address}`
        );
        // This could fail for a number of legitimate reasons, so we don't throw an error
        continue;
      }
    }
  }
}
