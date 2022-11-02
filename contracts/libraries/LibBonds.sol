// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "../storage/LibAppStorage.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";

library LibBonds {
    /// @notice Calculates the cursed bond that an signatory needs to lock
    /// up
    /// @dev The cursed bond amount is the digging fee
    /// @param diggingFee The digging fee of the vault
    /// @return The amount of cursed bond
    function calculateCursedBond(uint256 diggingFee)
        internal
        pure
        returns (uint256)
    {
        // TODO: We dont need this function unless we implement a better algorithm
        // for calculating the cursed bond
        // Anywhere this method is used should be replaced with just the digging fee
        return diggingFee;
    }

    /// @notice Decreases the amount stored in the freeBond mapping for an
    /// signatory. Reverts if the signatory's free bond is lower than
    /// the amount.
    /// @param signatory The address of the signatory whose
    /// free bond is being decreased
    /// @param amount The amount to decrease the free bond by
    function decreaseFreeBond(address signatory, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Revert if the amount is greater than the current free bond
        if (amount > s.signatoryProfiles[signatory].freeBond) {
            revert LibErrors.NotEnoughFreeBond(
                s.signatoryProfiles[signatory].freeBond,
                amount
            );
        }

        // Decrease the free bond amount
        s.signatoryProfiles[signatory].freeBond -= amount;
    }

    /// @notice Increases the amount stored in the freeBond mapping for an
    /// signatory.
    /// @param signatory The address of the signatory whose
    /// free bond is being decreased
    /// @param amount The amount to decrease the free bond by
    function increaseFreeBond(address signatory, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Increase the free bond amount
        s.signatoryProfiles[signatory].freeBond += amount;
    }

    /// @notice Decreases the amount stored in the cursedBond mapping for an
    /// signatory. Reverts if the signatory's cursed bond is lower than
    /// the amount.
    /// @param signatory The address of the signatory whose
    /// cursed bond is being decreased
    /// @param amount The amount to decrease the cursed bond by
    function decreaseCursedBond(address signatory, uint256 amount)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Revert if the amount is greater than the current cursed bond
        if (amount > s.signatoryProfiles[signatory].cursedBond) {
            revert LibErrors.NotEnoughCursedBond(
                s.signatoryProfiles[signatory].cursedBond,
                amount
            );
        }

        // Decrease the cursed bond amount
        s.signatoryProfiles[signatory].cursedBond -= amount;
    }

    /// @notice Increases the amount stored in the cursedBond mapping for an
    /// signatory.
    /// @param signatory The address of the signatory whose
    /// cursed bond is being decreased
    /// @param amount The amount to decrease the cursed bond by
    function increaseCursedBond(address signatory, uint256 amount)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Increase the cursed bond amount
        s.signatoryProfiles[signatory].cursedBond += amount;
    }

    /// @notice Locks up the signatory's bond, decreasing the
    /// signatory's free bond by an amount and increasing the
    /// signatory's cursed bond by the same amount.
    /// @param signatory The address of the signatory
    /// @param amount The amount to lock up
    function lockUpBond(address signatory, uint256 amount) internal {
        // Decrease the free bond amount
        decreaseFreeBond(signatory, amount);

        // Increase the cursed bond amount
        increaseCursedBond(signatory, amount);
    }

    /// @notice Unlocks the signatory's bond, increasing the
    /// signatory's free bond by an amount and decreasing the
    /// signatory's cursed bond by the same amount.
    /// @param signatory The address of the signatory
    /// @param amount The amount to unlock
    function unlockBond(address signatory, uint256 amount) internal {
        // Decrease the cursed bond amount
        decreaseCursedBond(signatory, amount);

        // Increase the free bond amount
        increaseFreeBond(signatory, amount);
    }

    /// @notice Calculates an signatory's cursed bond and curses them (locks
    /// up the free bond).
    /// @param vaultId the identifier of the vault to bond the signatory with
    /// @param signatory the address of the signatory to curse
    function curseSignatory(bytes32 vaultId, address signatory)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Get the signatory's data from storage
        LibTypes.SignatoryStorage memory signatoryData = s
            .vaultSignatories[vaultId][signatory];

        // Calculate the amount of cursed bond the signatories needs to lock up
        uint256 cursedBondAmount = calculateCursedBond(
            signatoryData.diggingFee
        );

        // Lock up the signatory's bond by the cursed bond amount
        lockUpBond(signatory, cursedBondAmount);
    }

    /// @notice Calculates an signatory's cursed bond and frees them
    /// (unlocks the cursed bond).
    /// @param vaultId the identifier of the vault to free the archaologist from
    /// @param signatory the address of the signatory to free
    function freeSignatory(bytes32 vaultId, address signatory)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Get the signatory's data from storage
        LibTypes.SignatoryStorage memory signatoryData = s
            .vaultSignatories[vaultId][signatory];

        // Calculate the amount of cursed bond the signatories needs to lock up
        uint256 cursedBondAmount = calculateCursedBond(
            signatoryData.diggingFee
        );

        // Free up the signatory's locked bond
        unlockBond(signatory, cursedBondAmount);
    }
}
