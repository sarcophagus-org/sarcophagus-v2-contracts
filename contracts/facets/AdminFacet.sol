// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {LibDiamond} from "../diamond/libraries/LibDiamond.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract AdminFacet {
    AppStorage internal s;

    /// @notice Withdraws the total protocol fee amount from the contract.
    /// @dev Can only be called by the owner.
    function withdrawProtocolFee() external {
        LibDiamond.enforceIsContractOwner();

        // Get the total protocol fees from storage
        uint256 totalProtocolFees = s.totalProtocolFees;

        // Set the total protocol fees to 0 before the transfer to avoid reentrancy
        s.totalProtocolFees = 0;

        // Transfer the protocol fee amount to the sender after setting state
        s.sarcoToken.transfer(msg.sender, totalProtocolFees);
    }
}
