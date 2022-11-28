import { ArchaeologistData } from "./archaeologistSignature";
import { expect } from "chai";
import { getContracts } from "./contracts";
import { Bytes } from "ethers";

/**
 * Given a set of archaeologists and sarcoId, asserts all have the expected accusal status
 * */
export const verifyAccusalStatusesForArchaeologists = async (
  sarcoId: Bytes,
  archaeologists: ArchaeologistData[],
  isAccused: boolean
): Promise<void> => {
  await Promise.all(
    archaeologists.map(async (archaeologist) => {
      const archaeologistStorage = await (
        await getContracts()
      ).viewStateFacet.getSarcophagusArchaeologist(
        sarcoId,
        archaeologist.archAddress
      );
      expect(archaeologistStorage.isAccused).to.equal(isAccused);
    })
  );
};
