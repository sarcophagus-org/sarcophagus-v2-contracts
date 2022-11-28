import { ArchaeologistData } from "./archaeologistSignature";
import { expect } from "chai";
import { getContracts } from "./contracts";
import { Bytes } from "ethers";
import { getFreshAccount } from "./accounts";
import { hashShare } from "./shamirSecretSharing";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SarcophagusData } from "./sarcophagus";

/**
 * Compromises a sarcophagus by accusing the threshold of archaeologists
 * @param sarcophagusData
 * @param archaeologists
 * @returns an object containing the accused archaeologists and the accuser's signer
 */
export const compromiseSarcophagus = async (
  sarcophagusData: SarcophagusData,
  archaeologists: ArchaeologistData[]
): Promise<{
  accusedArchaeologists: ArchaeologistData[];
  accuser: SignerWithAddress;
}> =>
  accuseArchaeologistsOnSarcophagus(
    sarcophagusData.threshold,
    sarcophagusData.sarcoId,
    archaeologists
  );

/**
 * Accuses count archaeologists on the sarcophagus with the supplied id
 * @param count
 * @param sarcoId
 * @param archaeologists
 * @returns an object containing the accused archaeologists and the accuser's signer
 */
export const accuseArchaeologistsOnSarcophagus = async (
  count: number,
  sarcoId: Bytes,
  archaeologists: ArchaeologistData[]
): Promise<{
  accusedArchaeologists: ArchaeologistData[];
  accuser: SignerWithAddress;
}> => {
  const { thirdPartyFacet } = await getContracts();
  const accuser = await getFreshAccount();

  const accusedArchaeologists = archaeologists.slice(0, count);

  // accuse count archaeologists of leaking a keyshare
  await thirdPartyFacet.connect(accuser).accuse(
    sarcoId,
    accusedArchaeologists.map((accusedArchaeologist) =>
      hashShare(accusedArchaeologist.rawKeyShare)
    ),
    accuser.address
  );
  return { accusedArchaeologists, accuser };
};

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
