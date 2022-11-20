import { ArchaeologistData } from "./archaeologist";
import { expect } from "chai";
import { getContracts } from "./contracts";

/**
 * Given a set of archaeologists and sarcoId, asserts all have the expected accusal status
 * */
export const verifyAccusalStatusesForArchaeologists = async (
  sarcoId: string,
  archaeologists: ArchaeologistData[],
  isAccused: boolean
) => {
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
