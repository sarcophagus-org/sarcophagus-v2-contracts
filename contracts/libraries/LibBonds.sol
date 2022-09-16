// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "../storage/LibAppStorage.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";

library LibBonds {
    /// @notice Calculates the cursed bond that an archaeologist needs to lock
    /// up
    /// @dev The cursed bond amount is the digging fee
    /// @param diggingFee The digging fee of the sarcophagus
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
    /// archaeologist. Reverts if the archaeologist's free bond is lower than
    /// the amount.
    /// @param archaeologist The address of the archaeologist whose
    /// free bond is being decreased
    /// @param amount The amount to decrease the free bond by
    function decreaseFreeBond(address archaeologist, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Revert if the amount is greater than the current free bond
        if (amount > s.archaeologistProfiles[archaeologist].freeBond) {
            revert LibErrors.NotEnoughFreeBond(
                s.archaeologistProfiles[archaeologist].freeBond,
                amount
            );
        }

        // Decrease the free bond amount
        s.archaeologistProfiles[archaeologist].freeBond -= amount;
    }

    /// @notice Increases the amount stored in the freeBond mapping for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// free bond is being decreased
    /// @param amount The amount to decrease the free bond by
    function increaseFreeBond(address archaeologist, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Increase the free bond amount
        s.archaeologistProfiles[archaeologist].freeBond += amount;
    }

    /// @notice Decreases the amount stored in the cursedBond mapping for an
    /// archaeologist. Reverts if the archaeologist's cursed bond is lower than
    /// the amount.
    /// @param archaeologist The address of the archaeologist whose
    /// cursed bond is being decreased
    /// @param amount The amount to decrease the cursed bond by
    function decreaseCursedBond(address archaeologist, uint256 amount)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Revert if the amount is greater than the current cursed bond
        if (amount > s.archaeologistProfiles[archaeologist].cursedBond) {
            revert LibErrors.NotEnoughCursedBond(
                s.archaeologistProfiles[archaeologist].cursedBond,
                amount
            );
        }

        // Decrease the cursed bond amount
        s.archaeologistProfiles[archaeologist].cursedBond -= amount;
    }

    /// @notice Increases the amount stored in the cursedBond mapping for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// cursed bond is being decreased
    /// @param amount The amount to decrease the cursed bond by
    function increaseCursedBond(address archaeologist, uint256 amount)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Increase the cursed bond amount
        s.archaeologistProfiles[archaeologist].cursedBond += amount;
    }

    /// @notice Locks up the archaeologist's bond, decreasing the
    /// archaeologist's free bond by an amount and increasing the
    /// archaeologist's cursed bond by the same amount.
    /// @param archaeologist The address of the archaeologist
    /// @param amount The amount to lock up
    function lockUpBond(address archaeologist, uint256 amount) internal {
        // Decrease the free bond amount
        decreaseFreeBond(archaeologist, amount);

        // Increase the cursed bond amount
        increaseCursedBond(archaeologist, amount);
    }

    /// @notice Unlocks the archaeologist's bond, increasing the
    /// archaeologist's free bond by an amount and decreasing the
    /// archaeologist's cursed bond by the same amount.
    /// @param archaeologist The address of the archaeologist
    /// @param amount The amount to unlock
    function unlockBond(address archaeologist, uint256 amount) internal {
        // Decrease the cursed bond amount
        decreaseCursedBond(archaeologist, amount);

        // Increase the free bond amount
        increaseFreeBond(archaeologist, amount);
    }

    /// @notice Calculates an archaeologist's cursed bond and curses them (locks
    /// up the free bond).
    /// @param sarcoId the identifier of the sarcophagus to bond the archaeologist with
    /// @param archaeologist the address of the archaeologist to curse
    function curseArchaeologist(bytes32 sarcoId, address archaeologist)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Get the archaeologist's data from storage
        LibTypes.ArchaeologistStorage memory archaeologistData = s
            .sarcophagusArchaeologists[sarcoId][archaeologist];

        // Calculate the amount of cursed bond the archaeologists needs to lock up
        uint256 cursedBondAmount = calculateCursedBond(
            archaeologistData.diggingFee
        );

        // Lock up the archaeologist's bond by the cursed bond amount
        lockUpBond(archaeologist, cursedBondAmount);
    }

    /// @notice Calculates an archaeologist's cursed bond and frees them
    /// (unlocks the cursed bond).
    /// @param sarcoId the identifier of the sarcophagus to free the archaologist from
    /// @param archaeologist the address of the archaeologist to free
    function freeArchaeologist(bytes32 sarcoId, address archaeologist)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Get the archaeologist's data from storage
        LibTypes.ArchaeologistStorage memory archaeologistData = s
            .sarcophagusArchaeologists[sarcoId][archaeologist];

        // Calculate the amount of cursed bond the archaeologists needs to lock up
        uint256 cursedBondAmount = calculateCursedBond(
            archaeologistData.diggingFee
        );

        // Free up the archaeologist's locked bond
        unlockBond(archaeologist, cursedBondAmount);
    }
}
