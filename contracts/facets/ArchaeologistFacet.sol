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

    /// @notice Withdraws froms an archaeologist's reward pool
    /// @param amount The amount to withdraw
    function withdrawReward(uint256 amount) external {
        _decreaseRewardPool(amount);

        // Transfer the amount of sarcoToken to the archaeologist
        s.sarcoToken.transfer(msg.sender, amount);

        emit LibEvents.WithdrawReward(msg.sender, amount);
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
        // Confirm that the archaeologist has not already unwrapped by checking
        // if the unencryptedShard is empty
        LibUtils.archaeologistUnwrappedCheck(identifier, msg.sender);

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

        // Comfirm that the sarcophagus has been finalized
        if (!LibUtils.isSarcophagusFinalized(identifier)) {
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

    /// @notice Finalizes a transfer of roles and responsibilities between two
    /// archaeologists. This is to be called by the new archaeologist.
    /// @param identifier The identifier of the sarcophagus
    /// @param arweaveTxId The id of the arweave transaction where the new shard
    /// @param oldArchSignature The signature of the old archaeologist
    /// was uploaded
    /// @return The boolean true if the operation was successful
    function finalizeTransfer(
        bytes32 identifier,
        string memory arweaveTxId,
        LibTypes.Signature memory oldArchSignature
    ) external returns (bool) {
        // Confirm that the sarcophagus exists
        if (
            s.sarcophaguses[identifier].state !=
            LibTypes.SarcophagusState.Exists
        ) {
            revert LibErrors.SarcophagusDoesNotExist(identifier);
        }

        // Confirm that the sarcophagus has been finalized
        if (!LibUtils.isSarcophagusFinalized(identifier)) {
            revert LibErrors.SarcophagusNotFinalized(identifier);
        }

        // Confirm that the resurrection time is in the future
        LibUtils.resurrectionInFuture(
            s.sarcophaguses[identifier].resurrectionTime
        );

        // Get the address that signed the oldArchSignature
        address oldArchaeologist = LibUtils.recoverAddress(
            bytes(arweaveTxId),
            oldArchSignature.v,
            oldArchSignature.r,
            oldArchSignature.s
        );

        // Confirm that the oldArchaeologist is an archaeologist on this
        // sarcophagus. Failure here means that someone besides an archaeologist
        // on the sarcophagus signed this message or that the data being signed
        // was not the provided arweaveTxId.
        if (!LibUtils.archaeologistExistsOnSarc(identifier, oldArchaeologist)) {
            revert LibErrors.SignerNotArchaeologistOnSarcophagus(
                identifier,
                oldArchaeologist
            );
        }

        // Update the list of archaeologist's on the sarcophagus
        // For each archaeologist on the sarcophagus, find the old archaeologist
        // and replace it with the sender's address.
        for (
            uint256 i = 0;
            i < s.sarcophaguses[identifier].archaeologists.length;
            i++
        ) {
            // Find the archaeologist that matches the old archaeologist's address
            if (
                s.sarcophaguses[identifier].archaeologists[i] ==
                oldArchaeologist
            ) {
                s.sarcophaguses[identifier].archaeologists[i] = msg.sender;

                // Once found there is no need to continue
                break;
            }
        }

        // Free the old archaeologist's bond
        LibBonds.freeArchaeologist(identifier, oldArchaeologist);

        LibTypes.ArchaeologistStorage storage newArchData = s
            .sarcophagusArchaeologists[identifier][msg.sender];
        LibTypes.ArchaeologistStorage storage oldArchData = s
            .sarcophagusArchaeologists[identifier][oldArchaeologist];

        // Add the new archaeologist's address to the sarcohpagusArchaeologists mapping
        newArchData.diggingFee = oldArchData.diggingFee;
        newArchData.bounty = oldArchData.bounty;
        newArchData.hashedShard = oldArchData.hashedShard;
        newArchData.unencryptedShard = "";

        // Set the old archaeologist's data in the sarcophagusArchaeologists
        // mapping to their default values
        oldArchData.diggingFee = 0;
        oldArchData.bounty = 0;
        oldArchData.hashedShard = 0;
        oldArchData.unencryptedShard = "";

        // Add the arweave transaction id to arweaveTxIds on the sarcophagus
        s.sarcophaguses[identifier].arweaveTxIds.push(arweaveTxId);

        // Curse the new archaeologist's bond
        LibBonds.curseArchaeologist(identifier, msg.sender);

        // Emit an event
        emit LibEvents.FinalizeTransfer(
            identifier,
            arweaveTxId,
            oldArchaeologist,
            msg.sender
        );
    }

    /// @notice Decreases the amount stored in the archaeologistRewards mapping for an
    /// archaeologist. Reverts if the archaeologist's reward is lower than
    /// the amount. Called on reward withdraw.
    /// @param amount The amount to decrease the reward by
    function _decreaseRewardPool(uint256 amount) private {
        // Revert if the amount is greater than the current reward
        if (amount > s.archaeologistRewards[msg.sender]) {
            revert LibErrors.NotEnoughReward(
                s.archaeologistRewards[msg.sender],
                amount
            );
        }

        // Decrease the free bond amount
        s.archaeologistRewards[msg.sender] -= amount;
    }

    /// @notice Increases the amount stored in the archaeologistRewards mapping for an
    /// archaeologist.
    /// @param amount The amount to increase the reward by
    function _increaseRewardPool(uint256 amount) private {
        s.archaeologistRewards[msg.sender] += amount;
    }
}
