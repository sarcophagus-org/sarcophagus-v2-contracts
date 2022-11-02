// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract VaultOwnerFacet {
    // IMPORTANT: AppStorage must be the first state variable in the facet.
    AppStorage internal s;

    event CreateVault(
        bytes32 indexed vaultId,
        string name,
        bool canBeTransferred,
        uint256 resurrectionTime,
        address vaultOwner,
        address recipient,
        address[] cursedSignatories,
        uint256 totalDiggingFees,
        uint256 createVaultProtocolFees,
        string[] arweaveTxIds
    );

    event RewrapVault(
        bytes32 indexed vaultId,
        uint256 resurrectionTime,
        uint256 totalDiggingFees,
        uint256 rewrapVaultProtocolFees
    );

    event BuryVault(bytes32 indexed vaultId);

    // Signatory's addresses are added to this mapping per vault to
    // verify that the same signatory signature is not used more than once.
    mapping(bytes32 => mapping(address => bool)) private verifiedSignatories;

    /// @notice Embalmer creates the vault.
    ///
    /// The purpose of createVault is to:
    ///   - Lock up payment for the selected signatories (digging fees)
    ///   - Store the arweave TX IDs pertaining to the encrypted file payload
    ///   -    and the encrypted shards
    ///   - Verify the selected signatories have signed off on the
    ///         double hash of their key share,
    ///         arweave tx id storing key shares,
    ///         and maximumRewrapInterval to be used for lifetime of the vault
    ///   - Store the selected signatories' addresses, digging fees and
    ///   -     unencrypted double hashes
    ///   - Curse each participating signatory
    ///   - Create the vault object
    ///
    /// @param vaultId the identifier of the vault
    /// @param vault an object that contains the vault data
    /// @param selectedSignatories the signatories the vaultOwner has selected to curse
    /// @param arweaveTxIds ordered pair of arweave tx ids: [tx storing vault payload,
    ///         tx storing the signatories' encrypted key shares]
    /// @return The index of the new vault
    function createVault(
        bytes32 vaultId,
        LibTypes.VaultMemory memory vault,
        LibTypes.SelectedSignatoryData[] memory selectedSignatories,
        string[] memory arweaveTxIds
    ) external returns (uint256) {
        // Confirm that this exact vault does not already exist
        if (
            s.vaults[vaultId].state !=
            LibTypes.VaultState.DoesNotExist
        ) {
            revert LibErrors.VaultAlreadyExists(vaultId);
        }

        // Confirm that the agreed upon vault parameters have not expired
        if (vault.timestamp + s.expirationThreshold < block.timestamp ) {
            revert LibErrors.VaultParametersExpired(
                vault.timestamp
            );
        }

        // Confirm that the resurrection time is in the future
        if (vault.resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(
                vault.resurrectionTime
            );
        }

        // Confirm that resurrection or rewrap will occur before the maximumRewrapInterval elapses
        if (vault.resurrectionTime > block.timestamp + vault.maximumRewrapInterval) {
            revert LibErrors.ResurrectionTimeTooFarInFuture(vault.resurrectionTime, vault.maximumRewrapInterval);
        }

        // Validate exactly 2 arweave TX IDs have been provided
        // TODO: See if we can verify exact byte length of arweave TXs
        if (arweaveTxIds.length != 2 || bytes(arweaveTxIds[0]).length == 0 || bytes(arweaveTxIds[1]).length == 0) {
            revert LibErrors.ArweaveTxIdsInvalid();
        }

        // Confirm that signatories are provided
        if (selectedSignatories.length == 0) {
            revert LibErrors.NoSignatoriesProvided();
        }

        // Confirm that minShards is greater than 0
        if (vault.minShards == 0) {
            revert LibErrors.MinShardsZero();
        }

        // Confirm that minShards is less than or equal to the number of signatories
        // (k <= n in a shamir secret sharing scheme)
        if (vault.minShards > selectedSignatories.length) {
            revert LibErrors.MinShardsGreaterThanSignatories(
                vault.minShards
            );
        }

        // Initialize a list of signatory addresses to be passed in to the
        // vault object
        address[] memory cursedSignatories = new address[](
            selectedSignatories.length
        );

        uint256 totalDiggingFees = 0;

        for (uint256 i = 0; i < selectedSignatories.length; i++) {
            LibTypes.SelectedSignatoryData memory signatory = selectedSignatories[i];
            LibUtils.revertIfSignatoryProfileDoesNotExist(signatory.signatoryAddress);

            // Confirm that the signatory list is unique. This is done by
            // checking that the signatory does not already exist from
            // previous iterations in this loop.
            if (LibUtils.signatoryExistsOnVault(vaultId, signatory.signatoryAddress)) {
                revert LibErrors.SignatoryListNotUnique(
                    cursedSignatories
                );
            }

            // Validate the signatory has signed off on the vault parameters: double hashed key share,
            // arweaveTxId[1] (tx storing share on arweave), maximumRewrapInterval for vault
            LibUtils.verifySignatorySignature(
                signatory.unencryptedShardDoubleHash,
                arweaveTxIds[1],
                vault.maximumRewrapInterval,
                vault.timestamp,
                signatory.diggingFee,
                signatory.v,
                signatory.r,
                signatory.s,
                signatory.signatoryAddress
            );

            totalDiggingFees += signatory.diggingFee;

            LibTypes.SignatoryStorage memory signatoryStorage = LibTypes
                .SignatoryStorage({
                    diggingFee: signatory.diggingFee,
                    diggingFeesPaid: 0,
                    unencryptedShardDoubleHash: signatory.unencryptedShardDoubleHash,
                    unencryptedShard: ""
                });

            // Map the double-hashed share to this signatory's address for easier referencing on accuse
            s.doubleHashedShardSignatories[signatory.unencryptedShardDoubleHash] = signatory
                .signatoryAddress;

            // Save the necessary signatory data to the vault
            s.vaultSignatories[vaultId][
                signatory.signatoryAddress
            ] = signatoryStorage;

            // Add the vault identifier to signatory's list of vaults
            s.signatoryVaults[signatory.signatoryAddress].push(vaultId);

            // Move free bond to cursed bond on signatory
            LibBonds.curseSignatory(vaultId, signatory.signatoryAddress);

            // Add the signatory address to the list of addresses to be
            // passed in to the vault object
            cursedSignatories[i] = signatory.signatoryAddress;
        }

        // Create the vault object and store it in AppStorage
        s.vaults[vaultId] = LibTypes.Vault({
            name: vault.name,
            state: LibTypes.VaultState.Exists,
            canBeTransferred: vault.canBeTransferred,
            minShards: vault.minShards,
            resurrectionTime: vault.resurrectionTime,
            maximumRewrapInterval: vault.maximumRewrapInterval,
            arweaveTxIds: arweaveTxIds,
            vaultOwner: msg.sender,
            recipientAddress: vault.recipient,
            signatories: cursedSignatories
        });

        // Add the identifier to the necessary data structures
        s.vaultIdentifiers.push(vaultId);
        s.vaultOwnerVaults[msg.sender].push(vaultId);
        s.recipientVaults[vault.recipient].push(vaultId);

        // Transfer the total fees amount + protocol fees in sarco token from the vaultOwner to this contract
        uint256 protocolFees = LibUtils.calculateProtocolFees(totalDiggingFees);

        // Add the create vault protocol fee to the total protocol fees in storage
        s.totalProtocolFees += protocolFees;

        s.heritageToken.transferFrom(
            msg.sender,
            address(this),
            totalDiggingFees + protocolFees
        );

        // Emit the event
        emit CreateVault(
            vaultId,
            vault.name,
            vault.canBeTransferred,
            vault.resurrectionTime,
            msg.sender,
            vault.recipient,
            cursedSignatories,
            totalDiggingFees,
            protocolFees,
            arweaveTxIds
        );

        // Return the index of the vault
        return s.vaultIdentifiers.length - 1;
    }

    /// @notice The vaultOwner may extend the life of the vault as long as
    /// the resurrection time has not passed yet.
    /// @dev The vaultOwner sets a new resurrection time sometime in the future.
    /// @param vaultId the identifier of the vault
    /// @param resurrectionTime the new resurrection time
    function rewrapVault(bytes32 vaultId, uint256 resurrectionTime)
        external
    {
        // Confirm that the vault exists
        if (s.vaults[vaultId].state != LibTypes.VaultState.Exists) {
            revert LibErrors.VaultDoesNotExist(vaultId);
        }

        // Confirm that the sender is the vaultOwner
        if (s.vaults[vaultId].vaultOwner != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.vaults[vaultId].vaultOwner
            );
        }

        // Confirm current resurrection time is in future (vault is rewrappable)
        if (s.vaults[vaultId].resurrectionTime <= block.timestamp) {
            revert LibErrors.VaultIsUnwrappable();
        }

        // Confirm that the new resurrection time is in the future
        if (resurrectionTime <= block.timestamp) {
            revert LibErrors.NewResurrectionTimeInPast(resurrectionTime);
        }


        // Confirm that the new resurrection time doesn't exceed the vault's maximumRewrapInterval
        if (resurrectionTime > block.timestamp + s.vaults[vaultId].maximumRewrapInterval) {
            revert LibErrors.NewResurrectionTimeTooLarge(resurrectionTime);
        }

        // For each signatory on the vault, transfer their digging fee allocations to them
        address[] memory bondedSignatories = s
            .vaults[vaultId]
            .signatories;

        uint256 totalDiggingFees = 0;

        for (uint256 i = 0; i < bondedSignatories.length; i++) {
            // Get the signatory's fee data
            LibTypes.SignatoryStorage memory signatoryData = LibUtils
                .getSignatory(vaultId, bondedSignatories[i]);

            // Transfer the signatory's digging fee allocation to the signatory's reward pool
            s.signatoryRewards[bondedSignatories[i]] += signatoryData.diggingFee;

            // Add to the total of digging fees paid
            signatoryData.diggingFeesPaid += signatoryData.diggingFee;

            // Add the signatory's digging fee to the sum
            totalDiggingFees += signatoryData.diggingFee;

            // Update the signatory's data in storage
            s.vaultSignatories[vaultId][
                bondedSignatories[i]
            ] = signatoryData;
        }

        uint256 protocolFees = LibUtils.calculateProtocolFees(totalDiggingFees);

        // Add the protocol fee to the total protocol fees in storage
        s.totalProtocolFees += protocolFees;

        // Update the resurrectionTime on the vault to the supplied value
        s.vaults[vaultId].resurrectionTime = resurrectionTime;

        // Transfer the new digging fees from the vaultOwner to the vault contract.
        // Signatories may withdraw their due from their respective reward pools
        s.heritageToken.transferFrom(
            msg.sender,
            address(this),
            totalDiggingFees + protocolFees
        );

        // Emit an event
        emit RewrapVault(vaultId, resurrectionTime, totalDiggingFees, protocolFees);
    }

    /// @notice Permanently closes the vault, giving it no opportunity to
    /// be resurrected.
    /// This may only be done after finalizeVault and before the
    /// resurrection time has passed.
    /// @dev Extends the resurrection time into infinity so that that unwrap
    /// will never be successful.
    /// @param vaultId the identifier of the vault
    function buryVault(bytes32 vaultId) external {
        // Confirm that the vault exists
        if (s.vaults[vaultId].state != LibTypes.VaultState.Exists) {
            revert LibErrors.VaultDoesNotExist(vaultId);
        }

        // Confirm that the sender is the vaultOwner
        if (s.vaults[vaultId].vaultOwner != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.vaults[vaultId].vaultOwner
            );
        }

        // Confirm that the current resurrection time is in the future
        if (s.vaults[vaultId].resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(
                s.vaults[vaultId].resurrectionTime
            );
        }

        // Set resurrection time to infinity
        s.vaults[vaultId].resurrectionTime = 2**256 - 1;

        // Set vault state to done
        s.vaults[vaultId].state = LibTypes.VaultState.Done;

        // For each signatory on the vault,
        // 1. Unlock their cursed bond
        // 2. Transfer digging fees to the signatory.
        address[] memory bondedSignatories = s
            .vaults[vaultId]
            .signatories;

        for (uint256 i = 0; i < bondedSignatories.length; i++) {
            // Unlock the signatory's cursed bond
            LibBonds.freeSignatory(vaultId, bondedSignatories[i]);

            LibTypes.SignatoryStorage memory signatoryData = LibUtils
                .getSignatory(vaultId, bondedSignatories[i]);

            // Transfer the digging fees to the signatory's reward pool
            s.signatoryRewards[bondedSignatories[i]] += signatoryData.diggingFee;
        }

        // Emit an event
        emit BuryVault(vaultId);
    }
}
