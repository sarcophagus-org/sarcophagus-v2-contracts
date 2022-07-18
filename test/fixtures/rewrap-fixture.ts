import { ContractTransaction } from "ethers";
import time from "../utils/time";
import { createSarcoFixture } from "./create-sarco-fixture";

/**
 * A fixture to intialize and finalize a sarcophagus to set up a test that
 * performs a rewrapping.
 *
 * Defaults new resurrection time to 1 week from rewrap time.
 *
 * config has optional flags for skipping the rewrap
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
  sarcoName: string,
  newResurrectionDuration?: number
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

  // Advance to a minute before resurrection time
  await time.increase(time.duration.weeks(1) - 60);

  const currentTime = await time.latest();
  const _newResurrectionTime =
    newResurrectionDuration === undefined
      ? currentTime + time.duration.weeks(1) // Default new resurrection time to 1 week from current time
      : currentTime + newResurrectionDuration;

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
    tx = embalmerFacet.connect(embalmer).rewrapSarcophagus(sarcoId, _newResurrectionTime);
  }

  if (config.dontAwaitTransaction !== true) {
    await tx;
  }

  return {
    viewStateFacet,
    sarcoId,
    oldResurrectionTime,
    newResurrectionTime: _newResurrectionTime,
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
