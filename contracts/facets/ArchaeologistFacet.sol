// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
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

    /// @notice Unwraps the sarcophagus.
    /// @dev Verifies that the unencrypted shard matches the hashedShard stored
    /// on chain and pays the archaeologist.
    /// @param identifier The identifier of the sarcophagus
    /// @param unencryptedShard The archaeologist's corresponding unencrypted shard
    /// @return The boolean true if the operation was successful
    function unwrapSarcophagus(
        bytes32 identifier,
        bytes memory unencryptedShard
    ) external returns (bool) {
        // Confirm that the sarcophagus exists
        if (
            s.sarcophaguses[identifier].state !=
            LibTypes.SarcophagusState.Exists
        ) {
            revert LibErrors.SarcophagusDoesNotExist(identifier);
        }

        // Confirm that the sender is an archaeologist on this sarcophagus
        if (!LibUtils.archaeologistExistsOnSarc(identifier, msg.sender)) {
            revert LibErrors.ArchaeologistNotOnSarcophagus(msg.sender);
        }

        // Confirm that the resurrection time has passed and that the
        // resurrection window has not passed
        LibUtils.unwrapTime(
            s.sarcophaguses[identifier].resurrectionTime,
            s.sarcophaguses[identifier].resurrectionWindow
        );

        // Confirm that the archaeologist has not already unwrapped by checking if the unencryptedShard is empty
        LibUtils.archaeologistUnwrappedCheck(identifier, msg.sender);

        // Get the archaeologist's data from storage
        LibTypes.ArchaeologistStorage memory archaeologistData = LibUtils
            .getArchaeologist(identifier, msg.sender);

        // Confirm that the hash of the unencrypted shard matches the hashedShard in storage
        if (keccak256(unencryptedShard) != archaeologistData.hashedShard) {
            revert LibErrors.UnencryptedShardHashMismatch(
                unencryptedShard,
                archaeologistData.hashedShard
            );
        }

        // Store the unencrypted shard in on the archaeologist object in the sarcophagus
        s
        .sarcophagusArchaeologists[identifier][msg.sender]
            .unencryptedShard = unencryptedShard;

        // Set the sarcophagus state as done
        s.sarcophaguses[identifier].state = LibTypes.SarcophagusState.Done;

        // Free the archaeologist's cursed bond
        LibBonds.freeArchaeologist(identifier, msg.sender);

        // Save the successful sarcophagus against the archaeologist
        s.archaeologistSuccesses[msg.sender].push(identifier);

        // Transfer the bounty and digging fee to the archaeologist
        s.sarcoToken.transfer(
            msg.sender,
            archaeologistData.bounty + archaeologistData.diggingFee
        );

        // Emit an event
        emit LibEvents.UnwrapSarcophagus(identifier, unencryptedShard);

        return true;
    }
}
