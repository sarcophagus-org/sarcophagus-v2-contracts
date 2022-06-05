// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "../../libraries/LibTypes.sol";
import {LibDiamond} from "../../diamond/libraries/LibDiamond.sol";
import "../../storage/LibAppStorage.sol";

/// @title The archaeologists library
/// @dev This library contains the internal and shared functions for archaeologists feature
library LibArchaeologists {
    /**
     * @notice Checks that an archaeologist exists, or doesn't exist, and
     * and reverts if necessary
     * @param account the archaeologist address to check existence of
     * @param exists bool which flips whether function reverts if archaeologist
     * exists or not
     */
    function archaeologistExists(address account, bool exists) internal view {
        AppStorage storage s = LibAppStorage.getAppStorage();
        // set the error message
        string memory err = "archaeologist has not been registered yet";
        if (!exists) err = "archaeologist has already been registered";

        // revert if necessary
        require(s.archaeologists[account].exists == exists, err);
    }

    /**
     * @notice Increases internal data structure which tracks free bond per
     * archaeologist
     * @param archAddress the archaeologist's address to operate on
     * @param amount the amount to increase free bond by
     */
    function increaseFreeBond(address archAddress, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();
        // load up the archaeologist
        LibTypes.Archaeologist storage arch = s.archaeologists[archAddress];

        // increase the freeBond variable by amount
        arch.freeBond = arch.freeBond + amount;
    }

    /**
     * @notice Decreases internal data structure which tracks free bond per
     * archaeologist
     * @param archAddress the archaeologist's address to operate on
     * @param amount the amount to decrease free bond by
     */
    function decreaseFreeBond(address archAddress, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // load up the archaeologist
        LibTypes.Archaeologist storage arch = s.archaeologists[archAddress];

        // decrease the free bond variable by amount, reverting if necessary
        require(
            arch.freeBond >= amount,
            "archaeologist does not have enough free bond"
        );
        arch.freeBond = arch.freeBond - amount;
    }

    /**
     * @notice Increases internal data structure which tracks cursed bond per
     * archaeologist
     * @param archAddress the archaeologist's address to operate on
     * @param amount the amount to increase cursed bond by
     */
    function increaseCursedBond(address archAddress, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // load up the archaeologist
        LibTypes.Archaeologist storage arch = s.archaeologists[archAddress];

        // increase the freeBond variable by amount
        arch.cursedBond = arch.cursedBond + amount;
    }

    /**
     * @notice Decreases internal data structure which tracks cursed bond per
     * archaeologist
     * @param archAddress the archaeologist's address to operate on
     * @param amount the amount to decrease cursed bond by
     */
    function decreaseCursedBond(address archAddress, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // load up the archaeologist
        LibTypes.Archaeologist storage arch = s.archaeologists[archAddress];

        // decrease the free bond variable by amount
        arch.cursedBond = arch.cursedBond - amount;
    }

    /**
     * @notice Given an archaeologist and amount, decrease free bond and
     * increase cursed bond
     * @param archAddress the archaeologist's address to operate on
     * @param amount the amount to decrease free bond and increase cursed bond
     */
    function lockUpBond(address archAddress, uint256 amount) internal {
        decreaseFreeBond(archAddress, amount);
        increaseCursedBond(archAddress, amount);
    }

    /**
     * @notice Given an archaeologist and amount, increase free bond and
     * decrease cursed bond
     * @param archAddress the archaeologist's address to operate on
     * @param amount the amount to increase free bond and decrease cursed bond
     */
    function freeUpBond(address archAddress, uint256 amount) internal {
        increaseFreeBond(archAddress, amount);
        decreaseCursedBond(archAddress, amount);
    }

    /**
     * @notice Calculates and returns the curse for any sarcophagus
     * @param diggingFee the digging fee of a sarcophagus
     * @param bounty the bounty of a sarcophagus
     * @return amount of the curse
     * @dev Current implementation simply adds the two inputs together. Future
     * strategies should use historical data to build a curve to change this
     * amount over time.
     */
    function getCursedBond(uint256 diggingFee, uint256 bounty)
        internal
        pure
        returns (uint256)
    {
        // TODO: implment a better algorithm, using some concept of past state
        return diggingFee + bounty;
    }
}
