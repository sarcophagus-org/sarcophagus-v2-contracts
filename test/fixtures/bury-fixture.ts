import { ContractTransaction } from "ethers";
import { createVaultFixture } from "./create-vault-fixture";

/**
 * A fixture to intialize and finalize a vault to set up a test that
 * performs a vault bury. config has optional flags for skipping the bury
 * contract call, skipping finalising the vault, and not awaiting
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
  vaultName: string
) => {
  const {
    vaultId,
    signatories,
    heritageToken,
    vaultOwner,
    vaultOwnerBalanceBeforeCreate: vaultOwnerBalanceBeforeCreate,
    vaultOwnerFacet,
    viewStateFacet,
  } = await createVaultFixture(config, vaultName);

  // Get the vault balance of the regular signatory before bury
  const regularSignatory = signatories[1];
  const regularSignatoryBalance = await heritageToken.balanceOf(signatories[1].signatoryAddress);

  // Get the regular signatory's free bond before bury
  const regularSignatoryFreeBondBefore = await viewStateFacet.getFreeBond(
    regularSignatory.signatoryAddress
  );

  // Get the regular signatory's cursed bond before bury
  const regularSignatoryCursedBondBefore = await viewStateFacet.getCursedBond(
    regularSignatory.signatoryAddress
  );

  const vaultOwnerBalanceBeforeBury = await heritageToken.balanceOf(vaultOwner.address);

  let tx: Promise<ContractTransaction> | undefined;
  if (config.skipBury !== true) {
    tx = vaultOwnerFacet.connect(vaultOwner).buryVault(vaultId);
  }

  if (config.dontAwaitTransaction !== true) {
    await tx;
  }

  return {
    viewStateFacet,
    vaultId,
    regularSignatory,
    regularSignatoryFreeBondBefore,
    regularSignatoryCursedBondBefore,
    heritageToken,
    regularSignatoryBalance,
    vaultOwner,
    signatories,
    vaultOwnerBalanceBeforeBury,
    vaultOwnerBalanceBeforeCreate,
    tx,
    vaultOwnerFacet,
  };
};
