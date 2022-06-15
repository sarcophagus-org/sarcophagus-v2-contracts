// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

/**
 * @title A collection of Errors
 * @notice This library defines all of the Errors that the Sarcophagus system
 * uses.
 */
library LibErrors {
    // Reverts when the msg.sender of a function is not the archaeologist
    error SenderNotArch(address sender, address arch);

    // Reverts when a sarcophagus that already exists is initialized
    error SarcophagusAlreadyExists(bytes32 identifier);

    // Reverts when a sarcophagus's resurrection time is set to the past
    error ResurrectionTimeInPast(uint256 resurrectionTime);

    // Reverts when an archaeologist doesn't have enough free bond upon initalizeSarophagus
    error NotEnoughFreeBond(uint256 freeBond, uint256 amount);

    // Reverts when an archaeologist doesn't have enough cursed bond when trying to withdraw cursed bond
    error NotEnoughCursedBond(uint256 cursedBond, uint256 amount);

    // Used when an attempt is made to clean a sarcophagus that has not exceeded its resurrection window
    error SarcophagusNotCleanable();
}
