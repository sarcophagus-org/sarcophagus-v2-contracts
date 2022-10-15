import { HardhatRuntimeEnvironment } from "hardhat/types";
import { generateHistoryConfig } from "./config";
import { SarcophagusData } from "./createSarcophagi";

export async function accuseSarcophagus(
  hre: HardhatRuntimeEnvironment,
  sarcophagiData: SarcophagusData[]
): Promise<string[]> {
  // Get hre ethers tools
  const { getSigners } = hre.ethers;
  const { keccak256 } = hre.ethers.utils;
  const sarcophagiToAccuse = generateHistoryConfig.accusedSarcophagusCount;

  // Anyone can be an accuser, even if the accuser is an archaeologist on the sarcophagus
  const accuser = (await getSigners())[0];

  // Get the contracts
  const diamond = await hre.ethers.getContract("Diamond_DiamondProxy");
  const thirdPartyFacet = await hre.ethers.getContractAt("ThirdPartyFacet", diamond.address);
  const sarcoToken = await hre.ethers.getContract("SarcoTokenMock");

  // Pick random sarcophagi to accuse
  // Shuffle and slice
  const accusedSarcophagi = sarcophagiData
    .sort(() => 0.5 - Math.random())
    .slice(0, sarcophagiToAccuse);

  console.log();
  console.log("Accusing archaeologists on sarcophagi...");
  for (let i = 0; i < sarcophagiToAccuse; i++) {
    const { sarcoId, shards } = accusedSarcophagi[i];
    const unencryptedShardHashes = Object.values(shards).map(shard => keccak256(shard));
    try {
      await thirdPartyFacet
        .connect(accuser)
        .accuse(sarcoId, unencryptedShardHashes, accuser.address);
      console.log(`(${i + 1}/${sarcophagiToAccuse}) Accused all archaeologists on ${sarcoId}`);
    } catch (_error) {
      const error = _error as Error;
      console.log(`(${i + 1}/${sarcophagiToAccuse}) Failed to accuse archaeologists on ${sarcoId}`);
      throw new Error(error.message);
    }
  }

  return accusedSarcophagi.map(sarcophagus => sarcophagus.sarcoId);
}
