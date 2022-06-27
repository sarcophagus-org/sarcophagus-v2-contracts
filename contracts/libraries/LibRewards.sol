// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "../storage/LibAppStorage.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";

library LibRewards {
    /// @notice Decreases the amount stored in the archaeologistRewards mapping for an
    /// archaeologist. Reverts if the archaeologist's reward is lower than
    /// the amount. Called on reward withdraw.
    /// @param archaeologist The address of the archaeologist whose
    /// reward is being decreased
    /// @param amount The amount to decrease the reward by
    function decreaseRewardPool(address archaeologist, uint256 amount)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Revert if the amount is greater than the current reward
        if (amount > s.archaeologistRewards[archaeologist]) {
            revert LibErrors.NotEnoughReward(
                s.archaeologistRewards[archaeologist],
                amount
            );
        }

        // Decrease the free bond amount
        s.archaeologistRewards[archaeologist] -= amount;
    }

    /// @notice Increases the amount stored in the archaeologistRewards mapping for an
    /// archaeologist.
    /// @param amount The amount to increase the reward by
    /// @param archaeologist The address of the archaeologist whose
    /// reward is being increased
    function increaseRewardPool(address archaeologist, uint256 amount)
        internal
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        s.archaeologistRewards[archaeologist] += amount;
    }
}
