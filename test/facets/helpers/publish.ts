import { ArchaeologistData } from "./archaeologistSignature";
import { getContracts } from "./contracts";
import { Bytes } from "ethers";
import { SarcophagusData } from "./sarcophagus";
import time from "../../utils/time";

const { ethers } = require("hardhat");

/**
 * Sets test time to sarcophagus resurrection time and publishes the key shares for the supplied archaeologists on the sarcophagus with the supplied id
 * @param sarcoId
 * @param archaeologists
 */
export const publishKeySharesForArchaeologists = async (
  sarcophagusData: SarcophagusData,
  archaeologists: ArchaeologistData[]
): Promise<void> => {
  const { archaeologistFacet } = await getContracts();
  await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
  await Promise.all(
    archaeologists.map(
      async (archaeologist: ArchaeologistData) =>
        await archaeologistFacet
          .connect(await ethers.getSigner(archaeologist.archAddress))
          .publishKeyShare(sarcophagusData.sarcoId, archaeologist.rawKeyShare)
    )
  );
};
