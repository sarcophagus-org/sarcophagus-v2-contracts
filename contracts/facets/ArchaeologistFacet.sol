// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibEvents} from "../libraries/LibEvents.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract ArchaeologistFacet {
    AppStorage internal s;

    /// @notice Deposits an archaeologist's free bond to the contract.
    /// @param archaeologist The address of the archaeologist whose
    /// free bond is being deposited
    /// @param amount The amount to deposit
    /// @param sarcoToken the sarcophagus ERC20 token SARC
    function depositFreeBond(
        address archaeologist,
        uint256 amount,
        IERC20 sarcoToken
    ) external {
        // Confirm that sender is the archaeologist
        if (msg.sender != archaeologist) {
            revert LibErrors.SenderNotArch(msg.sender, archaeologist);
        }

        // Increase the archaeolgist's free bond in app storage
        LibBonds.increaseFreeBond(archaeologist, amount);

        // Transfer the amount of sarcoToken from the archaeologist to the contract
        sarcoToken.transferFrom(msg.sender, address(this), amount);

        // Emit an event
        emit LibEvents.DepositFreeBond(archaeologist, amount);
    }

    /// @notice Withdraws an archaeologist's free bond from the contract.
    /// @param archaeologist The address of the archaeologist whose
    /// free bond is being withdrawn
    /// @param amount The amount to withdraw
    /// @param sarcoToken the sarcophagus ERC20 token SARC
    function withdrawFreeBond(
        address archaeologist,
        uint256 amount,
        IERC20 sarcoToken
    ) external {
        // Confirm that sender is the archaeologist
        if (msg.sender != archaeologist) {
            revert LibErrors.SenderNotArch(msg.sender, archaeologist);
        }

        // Decrease the archaeologist's free bond amount.
        // Reverts if there is not enough free bond on the contract.
        LibBonds.decreaseFreeBond(archaeologist, amount);

        // Transfer the amount of sarcoToken to the archaeologist
        sarcoToken.transfer(msg.sender, amount);

        // Emit an event
        emit LibEvents.WithdrawFreeBond(archaeologist, amount);
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
