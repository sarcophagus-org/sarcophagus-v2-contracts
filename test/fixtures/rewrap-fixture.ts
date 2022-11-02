import { BigNumber, ContractTransaction } from "ethers";
import time from "../utils/time";
import { createVaultFixture } from "./create-vault-fixture";

/**
 * A fixture to initialize and finalize a vault to set up a test that
 * performs a rewrapping.
 *
 * Defaults new resurrection time to 1 week from rewrap time.
 *
 * config has optional flags for skipping the rewrap
 * contract call, skipping finalising the vault, and not awaiting
 * the transaction Promise.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const rewrapFixture = async (
  config: {
    shares: number;
    threshold: number;
    skipRewrap?: boolean;
    skipAwaitRewrapTx?: boolean;
    signatoryMinDiggingFee?: BigNumber;
  },
  vaultName = "test init",
  newResurrectionDuration?: number
) => {
  const {
    heritageToken,
    vaultOwner,
    signatories,
    viewStateFacet,
    vaultOwnerFacet,
    vaultId,
    resurrectionTime: oldResurrectionTime,
  } = await createVaultFixture({ ...config }, vaultName);

  // Advance to a minute before resurrection time
  await time.increase(time.duration.weeks(1) - 60);

  const currentTime = await time.latest();
  const _newResurrectionTime =
    newResurrectionDuration === undefined
      ? currentTime + time.duration.weeks(1) // Default new resurrection time to 1 week from current time
      : currentTime + newResurrectionDuration;

  // Get the vaultOwner's balance before rewrap
  const vaultOwnerBalanceBeforeRewrap = await heritageToken.balanceOf(vaultOwner.address);

  // Get the total protocol fees on the contract before rewrap
  const totalProtocolFeesBeforeRewrap = await viewStateFacet.getTotalProtocolFees();

  // Get the contract's vault balance before rewrap
  const contractBalanceBefore = await heritageToken.balanceOf(viewStateFacet.address);

  // Calculate the vault balances for each signatory before unwrap
  const signatoryBalancesBefore = await Promise.all(
    signatories.map(async signatory => await heritageToken.balanceOf(signatory.signatoryAddress))
  );

  let tx: Promise<ContractTransaction> | undefined;
  if (config.skipRewrap !== true) {
    tx = vaultOwnerFacet.connect(vaultOwner).rewrapVault(vaultId, _newResurrectionTime);
  }

  if (config.skipAwaitRewrapTx !== true) {
    await tx;
  }

  return {
    viewStateFacet,
    vaultId,
    oldResurrectionTime,
    newResurrectionTime: _newResurrectionTime,
    signatories,
    heritageToken,
    signatoryBalancesBefore,
    vaultOwner,
    vaultOwnerBalanceBeforeRewrap,
    vaultOwnerFacet,
    totalProtocolFeesBeforeRewrap,
    contractBalanceBefore,
    tx,
  };
};
