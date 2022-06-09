// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibEvents} from "../libraries/LibEvents.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract ArchaeologistFacet {
    AppStorage internal s;

    /// @notice Deposits an archaeologist's free bond to the contract.
    /// @param archaegologistAddress The address of the archaeologist whose
    /// free bond is being deposited
    /// @param amount The amount to deposit
    /// @param sarcoToken the sarcophagus ERC20 token SARC
    function depositFreeBond(
        address archaegologistAddress,
        uint256 amount,
        IERC20 sarcoToken
    ) external {
        // Confirm that sender is the archaeologist
        require(
            msg.sender == archaegologistAddress,
            "sender must be the archaeologist"
        );

        // Increase the archaeolgist's free bond in app storage
        LibBonds.increaseFreeBond(archaegologistAddress, amount);

        // Transfer the amount of sarcoToken from the archaeologist to the contract
        sarcoToken.transferFrom(msg.sender, address(this), amount);

        // Emit an event
        emit LibEvents.DepositFreeBond(archaegologistAddress, amount);
    }

    /// @notice Withdraws an archaeologist's free bond from the contract.
    /// @param archaegologistAddress The address of the archaeologist whose
    /// free bond is being withdrawn
    /// @param amount The amount to withdraw
    /// @param sarcoToken the sarcophagus ERC20 token SARC
    function withdrawFreeBond(
        address archaegologistAddress,
        uint256 amount,
        IERC20 sarcoToken
    ) external {
        // Confirm that sender is the archaeologist
        require(
            msg.sender == archaegologistAddress,
            "sender must be the archaeologist"
        );

        // Decrease the archaeologist's free bond amount.
        // Reverts if there is not enough free bond on the contract.
        LibBonds.decreaseFreeBond(archaegologistAddress, amount);

        // Transfer the amount of sarcoToken to the archaeologist
        sarcoToken.transfer(msg.sender, amount);

        // Emit an event
        emit LibEvents.WithdrawFreeBond(archaegologistAddress, amount);
    }

    /// @notice Returns the amount of free bond stored in the contract for an
    /// archaeologist.
    /// @param archaegologistAddress The address of the archaeologist whose
    /// free bond is being returned
    function getFreeBond(address archaegologistAddress)
        external
        view
        returns (uint256)
    {
        return s.freeBonds[archaegologistAddress];
    }

    /// @notice Returns the amount of cursed bond stored in the contract for an
    /// archaeologist.
    /// @param archaegologistAddress The address of the archaeologist whose
    /// cursed bond is being returned
    function getCursedBond(address archaegologistAddress)
        external
        view
        returns (uint256)
    {
        return s.cursedBonds[archaegologistAddress];
    }
}
