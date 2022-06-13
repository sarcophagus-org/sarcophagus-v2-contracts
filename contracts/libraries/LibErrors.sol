// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

/**
 * @title A collection of Errors
 * @notice This library defines all of the Errors that the Sarcophagus system
 * uses.
 */
library LibErrors {
    error SenderNotArch(address sender, address arch);
}
