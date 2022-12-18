import { ArchaeologistData } from "./archaeologistSignature";
import { getContracts } from "./contracts";
import { SarcophagusData } from "./sarcophagus";
import time from "../../utils/time";

const { ethers } = require("hardhat");

/**
 * Sets test time to sarcophagus resurrection time and publishes the private keys for the supplied archaeologists on the sarcophagus with the supplied id
 * @param sarcophagusData
 * @param archaeologists
 */
export const publishPrivateKeysForArchaeologists = async (
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
          .publishPrivateKey(
            sarcophagusData.sarcoId,
            "0x" + archaeologist.privateKey
          )
    )
  );
};
