import { ContractTransaction } from "ethers";
import { createSarcoFixture } from "./create-sarco-fixture";

/**
 * A fixture to intialize and finalize a sarcophagus to set up a test that
 * performs a sarcophagus bury. config has optional flags for skipping the bury
 * contract call, skipping finalising the sarcophagus, and not awaiting
 * the transaction Promise.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const buryFixture = async (
  config: {
    shares: number;
    threshold: number;
    skipBury?: boolean;
    skipFinalize?: boolean;
    dontAwaitTransaction?: boolean;
  },
  sarcoName: string
) => {
  const {
    sarcoId,
    archaeologists,
    sarcoToken,
    embalmer,
    embalmerBalanceBeforeCreate: embalmerBalanceBeforeCreate,
    embalmerFacet,
    viewStateFacet,
  } = await createSarcoFixture(config, sarcoName);

  // Get the sarco balance of the regular archaeologist before bury
  const regularArchaeologist = archaeologists[1];
  const regularArchaeologistBalance = await sarcoToken.balanceOf(archaeologists[1].archAddress);

  // Get the regular archaeologist's free bond before bury
  const regularArchaeologistFreeBondBefore = await viewStateFacet.getFreeBond(
    regularArchaeologist.archAddress
  );

  // Get the regular archaeologist's cursed bond before bury
  const regularArchaeologistCursedBondBefore = await viewStateFacet.getCursedBond(
    regularArchaeologist.archAddress
  );

  const embalmerBalanceBeforeBury = await sarcoToken.balanceOf(embalmer.address);

  let tx: Promise<ContractTransaction> | undefined;
  if (config.skipBury !== true) {
    tx = embalmerFacet.connect(embalmer).burySarcophagus(sarcoId);
  }

  if (config.dontAwaitTransaction !== true) {
    await tx;
  }

  return {
    viewStateFacet,
    sarcoId,
    regularArchaeologist,
    regularArchaeologistFreeBondBefore,
    regularArchaeologistCursedBondBefore,
    sarcoToken,
    regularArchaeologistBalance,
    embalmer,
    archaeologists,
    embalmerBalanceBeforeBury,
    embalmerBalanceBeforeCreate,
    tx,
    embalmerFacet,
  };
};
