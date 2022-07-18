import { ContractTransaction } from "ethers";
import time from "../utils/time";
import { createSarcoFixture } from "./create-sarco-fixture";

/**
 * A fixture to intialize and finalize a sarcophagus to set up a test that
 * performs a rewrapping. config has optional flags for skipping the rewrap
 * contract call, skipping finalising the sarcophagus, and not awaiting
 * the transaction Promise.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const rewrapFixture = async (
  config: {
    shares: number;
    threshold: number;
    skipRewrap?: boolean;
    skipFinaliseSarco?: boolean;
    dontAwaitTransaction?: boolean;
  },
  sarcoName: string
) => {
  const {
    sarcoToken,
    embalmer,
    archaeologists,
    viewStateFacet,
    embalmerFacet,
    sarcoId,
    resurrectionTime: oldResurrectionTime,
  } = await createSarcoFixture({ ...config, skipFinalize: config.skipFinaliseSarco }, sarcoName);

  // Set new resurrection time for 2 weeks in the future
  const newResurrectionTime = (await time.latest()) + time.duration.weeks(2);

  // Get the embalmer's balance before rewrap
  const embalmerBalanceBefore = await sarcoToken.balanceOf(embalmer.address);

  // Get the total protocol fees on the contract before rewrap
  const totalProtocolFees = await viewStateFacet.getTotalProtocolFees();

  // Get the contract's sarco balance before rewrap
  const contractBalanceBefore = await sarcoToken.balanceOf(viewStateFacet.address);

  const oldResurrectionWindow = (await viewStateFacet.getSarcophagus(sarcoId)).resurrectionWindow;

  // Calculate the sarco balances for each archaeologist before unwrap
  const archBalancesBefore = await Promise.all(
    archaeologists.map(async archaeologist => await sarcoToken.balanceOf(archaeologist.archAddress))
  );

  let tx: Promise<ContractTransaction> | undefined;
  if (config.skipRewrap !== true) {
    tx = embalmerFacet.connect(embalmer).rewrapSarcophagus(sarcoId, newResurrectionTime);
  }

  if (config.skipFinaliseSarco !== true) {
    await tx;
  }

  return {
    viewStateFacet,
    sarcoId,
    oldResurrectionTime,
    newResurrectionTime,
    oldResurrectionWindow,
    archaeologists,
    sarcoToken,
    archBalancesBefore,
    embalmer,
    embalmerBalanceBefore,
    embalmerFacet,
    totalProtocolFees,
    contractBalanceBefore,
    tx,
  };
};
