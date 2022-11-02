// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract SignatoryFacet {
    AppStorage internal s;

    event FinalizeTransfer(
        bytes32 vaultId,
        string arweaveTxId,
        address oldSignatory,
        address newSignatory
    );

    event UnwrapVault(bytes32 indexed vaultId, bytes unencryptedShard);

    event DepositFreeBond(address indexed signatory, uint256 depositedBond);

    event RegisterSignatory(
        address indexed signatory,
        string peerId,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    );

    event UpdateSignatory(
        address indexed signatory,
        string peerId,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    );

    event WithdrawFreeBond(
        address indexed signatory,
        uint256 withdrawnBond
    );

    event WithdrawReward(
        address indexed signatory,
        uint256 withdrawnReward
    );

    /// @notice Registers the signatory profile
    /// @param peerId The libp2p identifier for the signatory
    /// @param minimumDiggingFee The signatory's minimum amount to accept for a digging fee
    /// @param maximumRewrapInterval The longest interval of time from a rewrap time the arch will accept
    /// for a resurrection
    /// @param freeBond How much bond the signatory wants to deposit during the register call (if any)
    function registerSignatory(
        string memory peerId,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    ) external {
        // verify that the signatory does not already exist
        LibUtils.revertIfSignatoryProfileExists(msg.sender);

        // create a new signatory
        LibTypes.SignatoryProfile memory newSignatory = LibTypes
            .SignatoryProfile({
                exists: true,
                peerId: peerId,
                minimumDiggingFee: minimumDiggingFee,
                maximumRewrapInterval: maximumRewrapInterval,
                freeBond: freeBond,
                cursedBond: 0
            });

        // transfer HERITAGE tokens from the signatory to this contract, to be
        // used as their free bond. can be 0.
        if (freeBond > 0) {
            s.heritageToken.transferFrom(msg.sender, address(this), freeBond);
        }

        // save the new signatory into relevant data structures
        s.signatoryProfiles[msg.sender] = newSignatory;
        s.signatoryProfileAddresses.push(msg.sender);

        emit RegisterSignatory(
            msg.sender,
            newSignatory.peerId,
            newSignatory.minimumDiggingFee,
            newSignatory.maximumRewrapInterval,
            newSignatory.freeBond
        );
    }

    /// @notice Updates the signatory profile
    /// @param peerId The libp2p identifier for the signatory
    /// @param minimumDiggingFee The signatory's minimum amount to accept for a digging fee
    /// @param maximumRewrapInterval The longest interval of time from a rewrap time the arch will accept
    /// for a resurrection
    /// freeBond How much bond the signatory wants to deposit during the update call (if any)
    function updateSignatory(
        string memory peerId,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    ) external {
        // verify that the signatory exists
        LibUtils.revertIfSignatoryProfileDoesNotExist(msg.sender);

        // create a new signatory
        LibTypes.SignatoryProfile storage existingSignatory = s
            .signatoryProfiles[msg.sender];
        existingSignatory.peerId = peerId;
        existingSignatory.minimumDiggingFee = minimumDiggingFee;
        existingSignatory.maximumRewrapInterval = maximumRewrapInterval;

        // transfer HERITAGE tokens from the signatory to this contract, to be
        // used as their free bond. can be 0.
        if (freeBond > 0) {
            LibBonds.increaseFreeBond(msg.sender, freeBond);
            s.heritageToken.transferFrom(msg.sender, address(this), freeBond);
        }

        emit UpdateSignatory(
            msg.sender,
            existingSignatory.peerId,
            existingSignatory.minimumDiggingFee,
            existingSignatory.maximumRewrapInterval,
            existingSignatory.freeBond
        );
    }

    /// @notice Deposits an signatory's free bond to the contract.
    /// @param amount The amount to deposit
    function depositFreeBond(uint256 amount) external {
        LibUtils.revertIfSignatoryProfileDoesNotExist(msg.sender);
        // Increase the signatory's free bond in app storage
        LibBonds.increaseFreeBond(msg.sender, amount);

        // Transfer the amount of heritageToken from the signatory to the contract
        s.heritageToken.transferFrom(msg.sender, address(this), amount);
        // Emit an event
        emit DepositFreeBond(msg.sender, amount);
    }

    /// @notice Withdraws an signatory's free bond from the contract.
    /// @param amount The amount to withdraw
    function withdrawFreeBond(uint256 amount) external {
        LibUtils.revertIfSignatoryProfileDoesNotExist(msg.sender);
        // Decrease the signatory's free bond amount.
        // Reverts if there is not enough free bond on the contract.
        LibBonds.decreaseFreeBond(msg.sender, amount);

        // Transfer the amount of heritageToken to the signatory
        s.heritageToken.transfer(msg.sender, amount);

        // Emit an event
        emit WithdrawFreeBond(msg.sender, amount);
    }

    /// @notice Withdraws all rewards from an signatory's reward pool
    function withdrawReward() external {
        uint256 amountToWithdraw = s.signatoryRewards[msg.sender];
        s.signatoryRewards[msg.sender] = 0;

        // Transfer the amount of heritageToken to the signatory
        s.heritageToken.transfer(msg.sender, amountToWithdraw);

        emit WithdrawReward(msg.sender, amountToWithdraw);
    }

    /// @notice Unwraps the vault.
    /// @dev Verifies that the unencrypted shard matches the hashedShard stored
    /// on chain and pays the signatory.
    /// @param vaultId The identifier of the vault to unwrap
    /// @param unencryptedShard The signatory's corresponding unencrypted shard
    function unwrapVault(bytes32 vaultId, bytes memory unencryptedShard)
        external
    {
        // Confirm that the signatory has not already unwrapped by checking
        // if the unencryptedShard is empty
        LibUtils.signatoryUnwrappedCheck(vaultId, msg.sender);

        // Confirm that the vault exists
        if (s.vaults[vaultId].state != LibTypes.VaultState.Exists) {
            revert LibErrors.VaultDoesNotExist(vaultId);
        }

        // Confirm that the sender is an signatory on this vault
        if (!LibUtils.signatoryExistsOnVault(vaultId, msg.sender)) {
            revert LibErrors.SignatoryNotOnVault(msg.sender);
        }

        // Confirm that the resurrection time has passed and that the
        // grace period has not passed
        LibUtils.unwrapTime(s.vaults[vaultId].resurrectionTime);

        // Get the signatory's data from storage
        LibTypes.SignatoryStorage memory signatoryData = LibUtils
            .getSignatory(vaultId, msg.sender);

        // Confirm that the double hash of the unencrypted shard matches the hashedShard in storage
        bytes32 doubleHash = keccak256(abi.encode(keccak256(unencryptedShard)));
        if (doubleHash != signatoryData.unencryptedShardDoubleHash) {
            revert LibErrors.UnencryptedShardHashMismatch(
                unencryptedShard,
                signatoryData.unencryptedShardDoubleHash
            );
        }

        // Store the unencrypted shard in on the signatory object in the vault
        s
        .vaultSignatories[vaultId][msg.sender]
            .unencryptedShard = unencryptedShard;

        // Free the signatory's cursed bond
        LibBonds.freeSignatory(vaultId, msg.sender);

        // Save the successful vault against the signatory
        s.signatoryVaultSuccesses[msg.sender][vaultId] = true;
        s.signatorySuccesses[msg.sender].push(vaultId);

        // Transfer the digging fee to the signatory's reward pool
        s.signatoryRewards[msg.sender] += signatoryData.diggingFee;

        // Emit an event
        emit UnwrapVault(vaultId, unencryptedShard);
    }

    /// @notice Finalizes a transfer of roles and responsibilities between two
    /// signatories. This is to be called by the new signatory.
    /// @param vaultId The identifier of the vault
    /// @param arweaveTxId The id of the arweave transaction where the new shard
    /// @param oldSignatorySignature The signature of the old signatory
    /// was uploaded
    function finalizeTransfer(
        bytes32 vaultId,
        string memory arweaveTxId,
        LibTypes.Signature memory oldSignatorySignature
    ) external {
        // Confirm that the vault exists
        if (s.vaults[vaultId].state != LibTypes.VaultState.Exists) {
            revert LibErrors.VaultDoesNotExist(vaultId);
        }

        // Confirm that the resurrection time is in the future
        LibUtils.resurrectionInFuture(s.vaults[vaultId].resurrectionTime);

        // Get the address that signed the oldSignatorySignature
        address oldSignatory = LibUtils.recoverAddress(
            bytes(arweaveTxId),
            oldSignatorySignature.v,
            oldSignatorySignature.r,
            oldSignatorySignature.s
        );

        // Confirm that the oldSignatory is an signatory on this
        // vault. Failure here means that someone besides an signatory
        // on the vault signed this message or that the data being signed
        // was not the provided arweaveTxId.
        if (!LibUtils.signatoryExistsOnVault(vaultId, oldSignatory)) {
            revert LibErrors.SignerNotSignatoryOnVault(
                vaultId,
                oldSignatory
            );
        }

        // Update the list of signatory's on the vault
        // For each signatory on the vault, find the old signatory
        // and replace it with the sender's address.
        for (
            uint256 i = 0;
            i < s.vaults[vaultId].signatories.length;
            i++
        ) {
            // Find the signatory that matches the old signatory's address
            if (s.vaults[vaultId].signatories[i] == oldSignatory) {
                s.vaults[vaultId].signatories[i] = msg.sender;

                // Once found there is no need to continue
                break;
            }
        }

        // Free the old signatory's bond
        LibBonds.freeSignatory(vaultId, oldSignatory);

        LibTypes.SignatoryStorage storage newSignatoryData = s
            .vaultSignatories[vaultId][msg.sender];

        LibTypes.SignatoryStorage storage oldSignatoryData = s
            .vaultSignatories[vaultId][oldSignatory];

        // Add the new signatory's address to the heritagehpagusSignatories mapping
        newSignatoryData.diggingFee = oldSignatoryData.diggingFee;
        newSignatoryData.unencryptedShardDoubleHash = oldSignatoryData
            .unencryptedShardDoubleHash;
        newSignatoryData.unencryptedShard = "";

        // Set the old signatory's data in the vaultSignatories
        // mapping to their default values
        oldSignatoryData.diggingFee = 0;
        oldSignatoryData.unencryptedShardDoubleHash = 0;
        oldSignatoryData.unencryptedShard = "";

        // Add the arweave transaction id to arweaveTxIds on the vault
        s.vaults[vaultId].arweaveTxIds.push(arweaveTxId);

        // Curse the new signatory's bond
        LibBonds.curseSignatory(vaultId, msg.sender);

        // Emit an event
        emit FinalizeTransfer(
            vaultId,
            arweaveTxId,
            oldSignatory,
            msg.sender
        );
    }
}
