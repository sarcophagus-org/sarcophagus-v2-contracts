// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "../storage/LibAppStorage.sol";
import {LibErrors} from "../libraries/LibErrors.sol";

library LibBonds {
    /// @notice Calculates the cursed bond that an archaeologist needs to lock
    /// up
    /// @dev The cursed bond amount is the sum of the digging fee and the bounty
    function calculateCursedBond(uint256 diggingFee, uint256 bounty)
        internal
        pure
        returns (uint256)
    {
        // TODO: Implement a better algorithm for calculating the cursed bond
        return diggingFee + bounty;
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
        if (amount > s.freeBonds[archaeologist]) {
            revert LibErrors.NotEnoughFreeBond(
                s.freeBonds[archaeologist],
                amount
            );
        }

        // Decrease the free bond amount
        s.freeBonds[archaeologist] -= amount;
    }

    /// @notice Increases the amount stored in the freeBond mapping for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// free bond is being decreased
    /// @param amount The amount to decrease the free bond by
    function increaseFreeBond(address archaeologist, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Increase the free bond amount
        s.freeBonds[archaeologist] += amount;
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
        if (amount > s.cursedBonds[archaeologist]) {
            revert LibErrors.NotEnoughCursedBond(
                s.cursedBonds[archaeologist],
                amount
            );
        }

        // Decrease the cursed bond amount
        s.cursedBonds[archaeologist] -= amount;
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
        s.cursedBonds[archaeologist] += amount;
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

    /// @notice Given an array of archaeologists on a sarcophagus, sums the total of
    /// 1. Each archaeologists' bounty
    /// 2. Each archaeologists' digging fees
    /// 3. The storage fee
    /// @param identifier The identifier of the sarcophagus
    /// @param archaeologists The array of archaeologists' addresses
    /// @return the total of the above
    function calculateTotalFees(
        bytes32 identifier,
        address[] memory archaeologists
    ) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();

        uint256 totalFees = 0;

        // iterate through each archaeologist
        for (uint256 i = 0; i < archaeologists.length; i++) {
            LibTypes.ArchaeologistStorage memory archaeologistsData = s
                .sarcophagusArchaeologists[identifier][archaeologists[i]];

            // add the archaeologist's bounty to the total fees
            totalFees += archaeologistsData.bounty;

            // add the archaeologist's digging fee to the total fees
            totalFees += archaeologistsData.diggingFee;
        }

        // add the storage fee to the total fees
        totalFees += s.sarcophaguses[identifier].storageFee;

        // return the total fees
        return totalFees;
    }
}
