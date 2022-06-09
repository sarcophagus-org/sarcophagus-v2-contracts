// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "../storage/LibAppStorage.sol";

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
    /// @param archaegologistAddress The address of the archaeologist whose
    /// free bond is being decreased
    /// @param amount The amount to decrease the free bond by
    function decreaseFreeBond(address archaegologistAddress, uint256 amount)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Revert if the amount is greater than the current free bond
        require(
            amount <= s.freeBonds[archaegologistAddress],
            "Archaeologist does not have enough free bond"
        );

        // Decrease the free bond amount
        s.freeBonds[archaegologistAddress] -= amount;
    }

    /// @notice Increases the amount stored in the freeBond mapping for an
    /// archaeologist.
    /// @param archaegologistAddress The address of the archaeologist whose
    /// free bond is being decreased
    /// @param amount The amount to decrease the free bond by
    function increaseFreeBond(address archaegologistAddress, uint256 amount)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Increase the free bond amount
        s.freeBonds[archaegologistAddress] += amount;
    }

    /// @notice Decreases the amount stored in the cursedBond mapping for an
    /// archaeologist. Reverts if the archaeologist's cursed bond is lower than
    /// the amount.
    /// @param archaegologistAddress The address of the archaeologist whose
    /// cursed bond is being decreased
    /// @param amount The amount to decrease the cursed bond by
    function decreaseCursedBond(address archaegologistAddress, uint256 amount)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Revert if the amount is greater than the current cursed bond
        require(
            amount <= s.cursedBonds[archaegologistAddress],
            "Archaeologist does not have enough cursed bond"
        );

        // Decrease the cursed bond amount
        s.cursedBonds[archaegologistAddress] -= amount;
    }

    /// @notice Increases the amount stored in the cursedBond mapping for an
    /// archaeologist.
    /// @param archaegologistAddress The address of the archaeologist whose
    /// cursed bond is being decreased
    /// @param amount The amount to decrease the cursed bond by
    function increaseCursedBond(address archaegologistAddress, uint256 amount)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Increase the cursed bond amount
        s.cursedBonds[archaegologistAddress] += amount;
    }

    /// @notice Locks up the archaeologist's bond, decreasing the
    /// archaeologist's free bond by an amount and increasing the
    /// archaeologist's cursed bond by the same amount.
    /// @param archaegologistAddress The address of the archaeologist
    /// @param amount The amount to lock up
    function lockUpBond(address archaegologistAddress, uint256 amount)
        internal
    {
        // Decrease the free bond amount
        decreaseFreeBond(archaegologistAddress, amount);

        // Increase the cursed bond amount
        increaseCursedBond(archaegologistAddress, amount);
    }

    /// @notice Given an array of archaeologists and a storage fee, sums the total of
    /// 1. Each archaeologists' bounty
    /// 2. Each archaeologists' digging fees
    /// 3. The storage fee
    /// @param archaeologists the array of archaeologists
    /// @param storageFee the storage fee
    /// @return the total of the above
    function calculateTotalFees(
        LibTypes.Archaeologist[] memory archaeologists,
        uint256 storageFee
    ) internal pure returns (uint256) {
        uint256 totalFees = 0;

        // iterate through each archaeologist
        for (uint256 i = 0; i < archaeologists.length; i++) {
            // add the archaeologist's bounty to the total fees
            totalFees += archaeologists[i].bounty;

            // add the archaeologist's digging fee to the total fees
            totalFees += archaeologists[i].diggingFee;
        }

        // add the storage fee to the total fees
        totalFees += storageFee;

        // return the total fees
        return totalFees;
    }
}
