// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibEvents} from "../libraries/LibEvents.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract ArchaeologistFacet {
    AppStorage internal s;

    /// @notice Deposits an archaeologist's free bond to the contract.
    /// @param amount The amount to deposit
    function depositFreeBond(uint256 amount) external {
        // Increase the archaeolgist's free bond in app storage
        LibBonds.increaseFreeBond(msg.sender, amount);

        // Transfer the amount of sarcoToken from the archaeologist to the contract
        s.sarcoToken.transferFrom(msg.sender, address(this), amount);

        // Emit an event
        emit LibEvents.DepositFreeBond(msg.sender, amount);
    }

    /// @notice Withdraws an archaeologist's free bond from the contract.
    /// @param amount The amount to withdraw
    function withdrawFreeBond(uint256 amount) external {
        // Decrease the archaeologist's free bond amount.
        // Reverts if there is not enough free bond on the contract.
        LibBonds.decreaseFreeBond(msg.sender, amount);

        // Transfer the amount of sarcoToken to the archaeologist
        s.sarcoToken.transfer(msg.sender, amount);

        // Emit an event
        emit LibEvents.WithdrawFreeBond(msg.sender, amount);
    }

    /// @notice Returns the amount of free bond stored in the contract for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// free bond is being returned
    function getFreeBond(address archaeologist)
        external
        view
        returns (uint256)
    {
        return s.freeBonds[archaeologist];
    }

    /// @notice Returns the amount of cursed bond stored in the contract for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// cursed bond is being returned
    function getCursedBond(address archaeologist)
        external
        view
        returns (uint256)
    {
        return s.cursedBonds[archaeologist];
    }
}
