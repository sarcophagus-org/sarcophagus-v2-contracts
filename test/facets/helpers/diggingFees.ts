import { getContracts } from "./contracts";
import { BigNumber } from "ethers";
import { ArchaeologistData } from "./archaeologistSignature";

/**
 * Returns the locked bond for the archaeologist
 * */
export const getArchaeologistLockedBondSarquitos = async (
  archaeologistAddress: string
): Promise<BigNumber> => {
  const { viewStateFacet } = await getContracts();
  return (await viewStateFacet.getArchaeologistProfile(archaeologistAddress))
    .cursedBond;
};

/**
 * Calculates the total digging fees for a set of archaeologists including the curse fee
 * */
export const getTotalFeesSarquitos = (
  archaeologists: ArchaeologistData[],
  resurrectionInterval: number
): BigNumber =>
  archaeologists.reduce(
    (sum: BigNumber, archaeologist: ArchaeologistData) =>
      sum
        .add(
          BigNumber.from(archaeologist.diggingFeePerSecondSarquito).mul(
            resurrectionInterval
          )
        )
        .add(archaeologist.curseFee),
    BigNumber.from(0)
  );

export const getTotalDiggingFeesSarquitos = (
  archaeologists: ArchaeologistData[],
  resurrectionInterval: number,
  includeCurseFee = true
): BigNumber =>
  archaeologists.reduce(
    (sum: BigNumber, archaeologist: ArchaeologistData) =>
      sum.add(
        BigNumber.from(archaeologist.diggingFeePerSecondSarquito)
          .mul(resurrectionInterval)
          .add(
            includeCurseFee
              ? BigNumber.from(archaeologist.curseFee)
              : BigNumber.from(0)
          )
      ),
    BigNumber.from(0)
  );

export const getDiggingFeesPlusProtocolFeesSarquitos = async (
  archaeologists: ArchaeologistData[],
  resurrectionInterval: number,
  includeCurseFee = true
): Promise<BigNumber> => {
  const { viewStateFacet } = await getContracts();
  const totalDiggingFees = getTotalDiggingFeesSarquitos(
    archaeologists,
    resurrectionInterval,
    includeCurseFee
  );
  return totalDiggingFees.add(
    totalDiggingFees
      .mul(await viewStateFacet.getProtocolFeeBasePercentage())
      .div(100)
  );
};

/**
 * Calculates the total digging fees for a set of archaeologists plus the protocol fees (incurred on rewrap and create)
 * */
export const getAllFeesSarquitos = async (
  archaeologists: ArchaeologistData[],
  resurrectionInterval: number
): Promise<BigNumber> => {
  const { viewStateFacet } = await getContracts();
  const totalDiggingFees = getTotalFeesSarquitos(
    archaeologists,
    resurrectionInterval
  );
  return totalDiggingFees.add(
    totalDiggingFees
      .mul(await viewStateFacet.getProtocolFeeBasePercentage())
      .div(100)
  );
};
