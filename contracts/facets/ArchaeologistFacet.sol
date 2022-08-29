// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibRewards} from "../libraries/LibRewards.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract ArchaeologistFacet {
    AppStorage internal s;

    event FinalizeTransfer(
        bytes32 sarcoId,
        string arweaveTxId,
        address oldArchaeologist,
        address newArchaeologist,
        uint256 curseTokenId
    );

    event UnwrapSarcophagus(bytes32 indexed sarcoId, bytes unencryptedShard);

    event DepositFreeBond(address indexed archaeologist, uint256 depositedBond);

    event RegisterArchaeologist(
        address indexed archaeologist,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    );

    event UpdateArchaeologist(
        address indexed archaeologist,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    );

    event WithdrawFreeBond(
        address indexed archaeologist,
        uint256 withdrawnBond
    );

    event WithdrawReward(
        address indexed archaeologist,
        uint256 withdrawnReward
    );

    function registerArchaeologist(
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    ) external {
        // verify that the archaeologist does not already exist
        LibUtils.revertIfArchProfileExists(msg.sender);

        // create a new archaeologist
        LibTypes.ArchaeologistProfile memory newArch =
            LibTypes.ArchaeologistProfile({
                exists: true,
                minimumDiggingFee: minimumDiggingFee,
                maximumRewrapInterval: maximumRewrapInterval,
                freeBond: freeBond,
                cursedBond: 0,
                rewards: 0
            });

        // transfer SARCO tokens from the archaeologist to this contract, to be
        // used as their free bond. can be 0.
        if (freeBond > 0) {
            s.sarcoToken.transferFrom(msg.sender, address(this), freeBond);
        }

        // save the new archaeologist into relevant data structures
        s.archaeologistProfiles[msg.sender] = newArch;
        s.archaeologistProfileAddresses.push(msg.sender);

        emit RegisterArchaeologist(
            msg.sender,
            newArch.minimumDiggingFee,
            newArch.maximumRewrapInterval,
            newArch.freeBond
        );
    }

    function updateArchaeologist(
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    ) external {
        // verify that the archaeologist exists
        LibUtils.revertIfArchProfileDoesNotExist(msg.sender);

        // create a new archaeologist
        LibTypes.ArchaeologistProfile storage existingArch = s.archaeologistProfiles[msg.sender];
        existingArch.minimumDiggingFee = minimumDiggingFee;
        existingArch.maximumRewrapInterval = maximumRewrapInterval;

        // transfer SARCO tokens from the archaeologist to this contract, to be
        // used as their free bond. can be 0.
        if (freeBond > 0) {
            LibBonds.increaseFreeBond(msg.sender, freeBond);
            s.sarcoToken.transferFrom(msg.sender, address(this), freeBond);
        }

        emit UpdateArchaeologist(
            msg.sender,
            existingArch.minimumDiggingFee,
            existingArch.maximumRewrapInterval,
            existingArch.freeBond
        );
    }

    /// @notice Deposits an archaeologist's free bond to the contract.
    /// @param amount The amount to deposit
    function depositFreeBond(uint256 amount) external {
        LibUtils.revertIfArchProfileDoesNotExist(msg.sender);
        // Increase the archaeologist's free bond in app storage
        LibBonds.increaseFreeBond(msg.sender, amount);

        // Transfer the amount of sarcoToken from the archaeologist to the contract
        s.sarcoToken.transferFrom(msg.sender, address(this), amount);
        // Emit an event
        emit DepositFreeBond(msg.sender, amount);
    }

    /// @notice Withdraws an archaeologist's free bond from the contract.
    /// @param amount The amount to withdraw
    function withdrawFreeBond(uint256 amount) external {
        LibUtils.revertIfArchProfileDoesNotExist(msg.sender);
        // Decrease the archaeologist's free bond amount.
        // Reverts if there is not enough free bond on the contract.
        LibBonds.decreaseFreeBond(msg.sender, amount);

        // Transfer the amount of sarcoToken to the archaeologist
        s.sarcoToken.transfer(msg.sender, amount);

        // Emit an event
        emit WithdrawFreeBond(msg.sender, amount);
    }

    /// @notice Withdraws froms an archaeologist's reward pool
    /// @param amount The amount to withdraw
    function withdrawReward(uint256 amount) external {
        LibRewards.decreaseRewardPool(msg.sender, amount);

        // Transfer the amount of sarcoToken to the archaeologist
        s.sarcoToken.transfer(msg.sender, amount);

        emit WithdrawReward(msg.sender, amount);
    }

    /// @notice Unwraps the sarcophagus.
    /// @dev Verifies that the unencrypted shard matches the hashedShard stored
    /// on chain and pays the archaeologist.
    /// @param sarcoId The identifier of the sarcophagus to unwrap
    /// @param unencryptedShard The archaeologist's corresponding unencrypted shard
    function unwrapSarcophagus(bytes32 sarcoId, bytes memory unencryptedShard)
        external
    {
        // Confirm that the archaeologist has not already unwrapped by checking
        // if the unencryptedShard is empty
        LibUtils.archaeologistUnwrappedCheck(sarcoId, msg.sender);

        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the sender is an archaeologist on this sarcophagus
        if (!LibUtils.archaeologistExistsOnSarc(sarcoId, msg.sender)) {
            revert LibErrors.ArchaeologistNotOnSarcophagus(msg.sender);
        }

        // Confirm that the resurrection time has passed and that the
        // resurrection window has not passed
        LibUtils.unwrapTime(s.sarcophagi[sarcoId].resurrectionTime);

        // Comfirm that the sarcophagus has been finalized
        if (!LibUtils.isSarcophagusFinalized(sarcoId)) {
            revert LibErrors.SarcophagusNotFinalized(sarcoId);
        }

        // Get the archaeologist's data from storage
        LibTypes.ArchaeologistStorage memory archaeologistData = LibUtils
            .getArchaeologist(sarcoId, msg.sender);

        // Confirm that the double hash of the unencrypted shard matches the hashedShard in storage
        bytes32 doubleHash = keccak256(abi.encode(keccak256(unencryptedShard)));
        if (doubleHash != archaeologistData.doubleHashedShard) {
            revert LibErrors.UnencryptedShardHashMismatch(
                unencryptedShard,
                archaeologistData.doubleHashedShard
            );
        }

        // Store the unencrypted shard in on the archaeologist object in the sarcophagus
        s
        .sarcophagusArchaeologists[sarcoId][msg.sender]
            .unencryptedShard = unencryptedShard;

        // Free the archaeologist's cursed bond
        LibBonds.freeArchaeologist(sarcoId, msg.sender);

        // Save the successful sarcophagus against the archaeologist
        s.archaeologistSuccesses[msg.sender][sarcoId] = true;

        // Transfer the bounty and digging fee to the archaeologist's reward pool
        LibRewards.increaseRewardPool(
            msg.sender,
            archaeologistData.bounty + archaeologistData.diggingFee
        );

        // Emit an event
        emit UnwrapSarcophagus(sarcoId, unencryptedShard);
    }

    /// @notice Finalizes a transfer of roles and responsibilities between two
    /// archaeologists. This is to be called by the new archaeologist.
    /// @param sarcoId The identifier of the sarcophagus
    /// @param arweaveTxId The id of the arweave transaction where the new shard
    /// @param oldArchSignature The signature of the old archaeologist
    /// was uploaded
    function finalizeTransfer(
        bytes32 sarcoId,
        string memory arweaveTxId,
        LibTypes.Signature memory oldArchSignature
    ) external {
        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the sarcophagus has been finalized
        if (!LibUtils.isSarcophagusFinalized(sarcoId)) {
            revert LibErrors.SarcophagusNotFinalized(sarcoId);
        }

        // Confirm that the resurrection time is in the future
        LibUtils.resurrectionInFuture(s.sarcophagi[sarcoId].resurrectionTime);

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
        if (!LibUtils.archaeologistExistsOnSarc(sarcoId, oldArchaeologist)) {
            revert LibErrors.SignerNotArchaeologistOnSarcophagus(
                sarcoId,
                oldArchaeologist
            );
        }

        // Update the list of archaeologist's on the sarcophagus
        // For each archaeologist on the sarcophagus, find the old archaeologist
        // and replace it with the sender's address.
        for (
            uint256 i = 0;
            i < s.sarcophagi[sarcoId].archaeologists.length;
            i++
        ) {
            // Find the archaeologist that matches the old archaeologist's address
            if (s.sarcophagi[sarcoId].archaeologists[i] == oldArchaeologist) {
                s.sarcophagi[sarcoId].archaeologists[i] = msg.sender;

                // Once found there is no need to continue
                break;
            }
        }

        // Free the old archaeologist's bond
        LibBonds.freeArchaeologist(sarcoId, oldArchaeologist);

        LibTypes.ArchaeologistStorage storage newArchData = s
            .sarcophagusArchaeologists[sarcoId][msg.sender];

        LibTypes.ArchaeologistStorage storage oldArchData = s
            .sarcophagusArchaeologists[sarcoId][oldArchaeologist];

        // Add the new archaeologist's address to the sarcohpagusArchaeologists mapping
        newArchData.diggingFee = oldArchData.diggingFee;
        newArchData.bounty = oldArchData.bounty;
        newArchData.doubleHashedShard = oldArchData.doubleHashedShard;
        newArchData.unencryptedShard = "";

        // Set the old archaeologist's data in the sarcophagusArchaeologists
        // mapping to their default values
        oldArchData.diggingFee = 0;
        oldArchData.bounty = 0;
        oldArchData.doubleHashedShard = 0;
        oldArchData.unencryptedShard = "";

        // Add the arweave transaction id to arweaveTxIds on the sarcophagus
        s.sarcophagi[sarcoId].arweaveTxIds.push(arweaveTxId);

        // Curse the new archaeologist's bond
        LibBonds.curseArchaeologist(sarcoId, msg.sender);

        // Transfer the nft to the new archaeologist. This is the only method of tranfering an nft
        // in the sarcophagus app. The owner of the nft may not transfer it themselves.
        // The contract needs to keep track of who owns the nft so that it can make the transfer
        // again if the new archaeologist chooses to transfer it to another archaeologist later on.
        newArchData.curseTokenId = oldArchData.curseTokenId;
        oldArchData.curseTokenId = 0;
        s.curses.safeTransferFrom(oldArchaeologist, msg.sender, newArchData.curseTokenId, 1, "");

        // Emit an event
        emit FinalizeTransfer(
            sarcoId,
            arweaveTxId,
            oldArchaeologist,
            msg.sender,
            newArchData.curseTokenId
        );
    }
}
