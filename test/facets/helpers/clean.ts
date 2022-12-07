import { getContracts } from "./contracts";
import time from "../../utils/time";

/**
 * Sets the test time to 1 second past the end of the embalmer claim window
 * embalmers will not be allowed to clean the sarcophagus at this point
 * @param resurrectionTimeSeconds
 */
export const setTimeToEmbalmerClaimWindowStart = async (
  resurrectionTimeSeconds: number
) => {
  const { viewStateFacet } = await getContracts();
  const publishDeadline =
    resurrectionTimeSeconds +
    (await viewStateFacet.getGracePeriod()).toNumber();
  await time.increaseTo(publishDeadline + 1);
};

/**
 * Sets the test time to 1 second past the end of the embalmer claim window
 * embalmers will not be allowed to clean the sarcophagus at this point
 * @param resurrectionTimeSeconds
 */
export const setTimeToAfterEmbalmerClaimWindowEnd = async (
  resurrectionTimeSeconds: number
) => {
  const { viewStateFacet } = await getContracts();
  const embalmerClaimWindow = await viewStateFacet.getEmbalmerClaimWindow();
  const publishDeadline =
    resurrectionTimeSeconds +
    (await viewStateFacet.getGracePeriod()).toNumber();
  await time.increaseTo(publishDeadline + embalmerClaimWindow.toNumber() + 1);
};
