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

        // Comfirm that the sarcophagus has been finalized
        if (bytes(s.sarcophaguses[identifier].arweaveTxId).length == 0) {
            revert LibErrors.SarcophagusNotFinalized(identifier);
        }

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

        // Free the archaeologist's cursed bond
        LibBonds.freeArchaeologist(identifier, msg.sender);

        // Save the successful sarcophagus against the archaeologist
        s.archaeologistSuccesses[msg.sender][identifier] = true;

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
