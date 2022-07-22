import { ContractTransaction } from "ethers";
import { createSarcoFixture } from "./create-sarco-fixture";

/**
 * A fixture to intialize a sarcophagus to set up a test that
 * requires a cancellation. config has optional flags for skipping the cancel
 * contract call, skipping finalising the sarcophagus, and not awaiting
 * the transaction Promise.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const cancelSarcoFixture = async (
  config: {
    shares: number;
    threshold: number;
    skipCancel?: boolean;
    doFinalize?: boolean;
    dontAwaitTransaction?: boolean;
  },
  sarcoName: string
) => {
  const {
    sarcoId,
    archaeologists,
    sarcoToken,
    embalmer,
    embalmerBalanceBefore: embalmerBalanceBeforeCreate,
    embalmerFacet,
    viewStateFacet,
  } = await createSarcoFixture({ ...config, skipFinalize: config.doFinalize !== true }, sarcoName);

  const embalmerBalanceBeforeCancel = await sarcoToken.balanceOf(embalmer.address);

  let tx: Promise<ContractTransaction> | undefined;
  if (config.skipCancel !== true) {
    tx = embalmerFacet.connect(embalmer).cancelSarcophagus(sarcoId);
  }

  if (config.dontAwaitTransaction !== true) {
    await tx;
  }

  return {
    tx,
    viewStateFacet,
    sarcoId,
    sarcoToken,
    embalmer,
    embalmerBalanceBeforeCreate,
    embalmerBalanceBeforeCancel,
    embalmerFacet,
    archaeologists,
  };
};
