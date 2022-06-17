// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import "../libraries/LibEvents.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract EmbalmerFacet {
    // IMPORTANT: AppStorage must be the first state variable in the facet.
    AppStorage internal s;

    // Archaeologist's addresses are added to this mapping per sarcophagus to
    // verify that the same archaeologist signature is not used more than once.
    mapping(bytes32 => mapping(address => bool)) private verifiedArchaeologists;

    /// @notice Embalmer creates the skeleton for a new sarcopahgus.
    ///
    /// InitializeSarcophagus is the first step of the two step mummification
    /// process.
    ///
    /// The purpose of intializeSarcophagus is to:
    ///   - Lock up payment for the archaeologists (bounty, digging fees, and storage fee)
    ///   - Store hashes of the unencrypted shards on chain
    ///   - Store the particapting archaeologists' addresses and individual
    ///     denominations of fees dedicated to each
    ///   - Create the sarcophagus object
    ///
    /// After initializeSarcophagus the archaeologists have been chosen but may
    /// have no knowledge of the sarcophagus yet. An archaeologist still needs
    /// to upload a payload to arweave and also communicate directly with the
    /// embalmer to indicate that they are ready to do work. After this the
    /// finalizeSarcohpagus() method should be called, which is the second step.
    ///
    /// @param name the name of the sarcophagus
    /// @param identifier the identifier of the sarcophagus
    /// @param archaeologists the data for the archaeologists
    /// @param arweaveArchaeologist The address of the archaeologist who uploads to arweave
    /// @param recipient the address of the recipient
    /// @param resurrectionTime the resurrection time of the sarcophagus
    /// @param canBeTransferred Whether the sarcophagus can be transferred
    /// @param minShards The minimum number of shards
    /// @return The index of the new sarcophagus
    function initializeSarcophagus(
        string memory name,
        bytes32 identifier,
        LibTypes.ArchaeologistMemory[] memory archaeologists,
        address arweaveArchaeologist,
        address recipient,
        uint256 resurrectionTime,
        bool canBeTransferred,
        uint8 minShards
    ) external returns (uint256) {
        // Confirm that this exact sarcophagus does not already exist
        if (
            s.sarcophaguses[identifier].state !=
            LibTypes.SarcophagusState.DoesNotExist
        ) {
            revert LibErrors.SarcophagusAlreadyExists(identifier);
        }

        // Confirm that the ressurection time is in the future
        if (resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(resurrectionTime);
        }

        // Confirm that archaeologists are provided
        if (archaeologists.length == 0) {
            revert LibErrors.NoArchaeologistsProvided();
        }

        // Confirm that minShards to less than the number of archaeologists
        if (minShards > archaeologists.length) {
            revert LibErrors.MinShardsGreaterThanArchaeologists(minShards);
        }

        // Confirm that minShards is greater than 0
        if (minShards == 0) {
            revert LibErrors.MinShardsZero();
        }

        // Initialize a list of archaeologist addresses to be passed in to the
        // sarcophagus object
        address[] memory archaeologistAddresses = new address[](
            archaeologists.length
        );

        // Initialize the storage fee of the archaeologist who uploades to
        // arweave. This will be obtained in the for loop and stored on the
        // sarcophagus object.
        uint256 storageFee = 0;

        // We need to iterate over every archaeologist to
        //   - lock up archaeologist's free bond
        //   - get the storage fee from the arweave archaeologist
        //   - store each archaeologist's bounty, digging fee, and unencrypted shard in app storage
        //   - get the archaeologist's address to store on the sarcophagus
        for (uint256 i = 0; i < archaeologists.length; i++) {
            // Confirm that the archaeologist list is unique. This is done by
            // checking that the archaeologist does not already exist from
            // previous iterations in this loop.
            if (
                archaeologistExists(identifier, archaeologists[i].archAddress)
            ) {
                revert LibErrors.ArchaeologistListNotUnique(
                    archaeologistAddresses
                );
            }

            // If the archaeologist is the arweave archaeologist, set the
            // storage fee. This is the only storage fee we care about.
            if (archaeologists[i].archAddress == arweaveArchaeologist) {
                storageFee = archaeologists[i].storageFee;
            }

            // Define an archaeologist storage object to be stored on the sarcophagus.
            LibTypes.ArchaeologistStorage memory archaeologistStorage = LibTypes
                .ArchaeologistStorage({
                    diggingFee: archaeologists[i].diggingFee,
                    bounty: archaeologists[i].bounty,
                    hashedShard: archaeologists[i].hashedShard
                });

            // Stores each archaeologist's bounty, digging fees, and unencrypted
            // shard in app storage per sarcophagus
            s.sarcophagusArchaeologists[identifier][
                archaeologists[i].archAddress
            ] = archaeologistStorage;

            // Add the sarcophagus identifier to archaeologist's list of sarcophaguses
            s.archaeologistSarcophaguses[archaeologists[i].archAddress].push(
                identifier
            );

            // Add the archaeologist address to the list of addresses to be
            // passed in to the sarcophagus object
            archaeologistAddresses[i] = archaeologists[i].archAddress;
        }

        // If the storage fee is 0, then the storage fee was never set since the
        // default value is 0. This means that either the arweave archaeologist
        // was not included in the list of archaeologists or the arweave
        // archaeologist set their storage fee to 0. In either case the
        // transaction should be reverted.
        if (storageFee == 0) {
            revert LibErrors.ArweaveArchaeologistNotInList();
        }

        // Create the sarcophagus object and store it in AppStorage
        s.sarcophaguses[identifier] = LibTypes.Sarcophagus({
            name: name,
            state: LibTypes.SarcophagusState.Exists,
            canBeTransferred: canBeTransferred,
            minShards: minShards,
            resurrectionTime: resurrectionTime,
            arweaveTxId: "",
            storageFee: storageFee,
            embalmer: msg.sender,
            recipientAddress: recipient,
            arweaveArchaeologist: arweaveArchaeologist,
            archaeologists: archaeologistAddresses
        });

        // Add the identifier to the necessary data structures
        s.sarcophagusIdentifiers.push(identifier);
        s.embalmerSarcophaguses[msg.sender].push(identifier);
        s.recipientSarcophaguses[recipient].push(identifier);

        // Calculate the total fees in sarco tokens that the contract will
        // receive from the embalmer
        uint256 totalFees = LibBonds.calculateTotalFees(
            identifier,
            archaeologistAddresses
        );

        // Transfer the total fees amount in sarco token from the msg.sender to this contract
        s.sarcoToken.transferFrom(msg.sender, address(this), totalFees);

        // Emit the event
        emit LibEvents.InitializeSarcophagus(
            identifier,
            name,
            canBeTransferred,
            resurrectionTime,
            msg.sender,
            recipient,
            arweaveArchaeologist,
            archaeologistAddresses
        );

        // Return the index of the sarcophagus
        return s.sarcophagusIdentifiers.length - 1;
    }

    /// @notice Embalmer finalizes the skeleton of a sarcophagus.
    ///
    /// FinalizeSarcophagus is the last step of the two step mummification
    /// process.
    ///
    /// The purpose of finalizeSarcophagus is to:
    ///   - Provide the archaeologists' signatures to the contract. These
    ///     confirm that the archaeologists approve the fees stored on the
    ///     contract and are ready to work.
    ///   - Provide the arweave transaction id to be stored on chain.
    ///   - Reward the archaeologist who uploaded to payload to arweave with the storage fee.
    ///
    /// @dev The archaeologistSignatures must be sent in the same order that the
    /// archaeologists were sent to the initializeSarcophagus function,
    /// otherwise the transaction will revert.
    /// @param identifier the identifier of the sarcophagus
    /// @param archaeologistSignatures the signatures of the archaeologists.
    /// This is archaeologist.length - 1 since the arweave archaeologist will be providing their own signature.
    /// @param arweaveArchaeologistSignature the signature of the archaeologist who uploaded to arweave
    /// @param arweaveTxId the arweave transaction id
    /// @return The boolean true if the operation was successful
    function finalizeSarcophagus(
        bytes32 identifier,
        LibTypes.SignatureWithAccount[] memory archaeologistSignatures,
        LibTypes.Signature memory arweaveArchaeologistSignature,
        string memory arweaveTxId
    ) external returns (bool) {
        // Confirm that the sarcophagus exists
        if (
            s.sarcophaguses[identifier].state !=
            LibTypes.SarcophagusState.Exists
        ) {
            revert LibErrors.SarcophagusDoesNotExist(identifier);
        }

        // Confirm that the embalmer is making this transaction
        if (s.sarcophaguses[identifier].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophaguses[identifier].embalmer
            );
        }

        // Confirm that the sarcophagus is not already finalized by checking if
        // the arweaveTxId is empty
        if (bytes(s.sarcophaguses[identifier].arweaveTxId).length > 0) {
            revert LibErrors.SarcophagusAlreadyFinalized(identifier);
        }

        // Confirm that the provided arweave transaction id is not empty
        if (bytes(arweaveTxId).length == 0) {
            revert LibErrors.ArweaveTxIdEmpty();
        }

        // Confirm that the correct number of archaeologist signatures was sent
        // This will be archaeologist.length - 1 since the arweave archaeoligist
        // will be providing their own signature.
        if (
            archaeologistSignatures.length !=
            s.sarcophaguses[identifier].archaeologists.length - 1
        ) {
            revert LibErrors.IncorrectNumberOfArchaeologistSignatures(
                archaeologistSignatures.length
            );
        }

        // Iterate over each regular archaeologist signature. This will not
        // include the arweave archaeologist.
        for (uint256 i = 0; i < archaeologistSignatures.length; i++) {
            // Confirm that this signauture has not already been verified. This
            // in combination with the signature length check guarantees that
            // each archaeologist gets verified and gets verified only once.
            if (
                verifiedArchaeologists[identifier][
                    archaeologistSignatures[i].account
                ]
            ) {
                revert LibErrors.SignatureListNotUnique();
            }

            // Confirm that the archaeologist address in the signature is on the
            // sarcophagus. The alternative to this is to iterate over each
            // archaeologist on the sarcophagus and run ecrecover to see if
            // there is a match. This is much more efficient.
            if (
                !archaeologistExists(
                    identifier,
                    archaeologistSignatures[i].account
                )
            ) {
                revert LibErrors.ArchaeologistNotOnSarcophagus(
                    archaeologistSignatures[i].account
                );
            }

            // Verify that the signature of the sarcophagus identifier came from
            // the archaeologist. This signature confirms that the archaeologist
            // approves the parameters of the sarcophagus (fees and resurrection
            // time) and is ready to work.
            LibUtils.verifyBytes32Signature(
                identifier,
                archaeologistSignatures[i].v,
                archaeologistSignatures[i].r,
                archaeologistSignatures[i].s,
                archaeologistSignatures[i].account
            );

            // Calculates the archaeologist's cursed bond and curses them (locks
            // up the free bond)
            LibBonds.curseArchaeologist(
                identifier,
                archaeologistSignatures[i].account
            );

            // Add this archaeologist to the mapping of verified archaeologists
            // so that it can't be checked again.
            verifiedArchaeologists[identifier][
                archaeologistSignatures[i].account
            ] = true;
        }

        // Verify that the signature of the arweave transaction id came from the
        // arweave archaeologist. This signature confirms that the archaeologist
        // approves the parameters of the sarcophagus (fees and resurrection
        // time) and is ready to work. The arweave archaeologist's signature in
        // particular is also used by the contract to confirm which
        // archaeologist uploaded the payload to arweave and should be paid the
        // storage fee.
        LibUtils.verifyBytesSignature(
            bytes(arweaveTxId),
            arweaveArchaeologistSignature.v,
            arweaveArchaeologistSignature.r,
            arweaveArchaeologistSignature.s,
            s.sarcophaguses[identifier].arweaveArchaeologist
        );

        // Calculates the arweave archaeologist's cursed bond and curses
        // them (locks up the free bond)
        LibBonds.curseArchaeologist(
            identifier,
            s.sarcophaguses[identifier].arweaveArchaeologist
        );

        // Store the arweave transaction id to the sarcophagus. The arweaveTxId
        // being populated indirectly designates the sarcophagus as finalized.
        s.sarcophaguses[identifier].arweaveTxId = arweaveTxId;

        // Transfer the storage fee to the arweave archaeologist after setting
        // the arweave transaction id.
        s.sarcoToken.transfer(
            s.sarcophaguses[identifier].arweaveArchaeologist,
            s.sarcophaguses[identifier].storageFee
        );

        // Emit an event
        emit LibEvents.FinalizeSarcophagus(identifier, arweaveTxId);

        return true;
    }

    /// @notice Cancels a sarcophagus. An embalmer may cancel a sarcophagus after
    /// `initializeSarcophagus` but before `finalizeSarcophagus`. The embalmer's
    /// fees that were locked up will be refunded.
    /// @param identifier the identifier of the sarcophagus
    /// @return The boolean true if the operation was successful

    function cancelSarcophagus(bytes32 identifier) external returns (bool) {
        // Confirm that the sender is the embalmer
        if (s.sarcophaguses[identifier].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophaguses[identifier].embalmer
            );
        }

        // Confirm that the sarcophagus exists
        if (
            s.sarcophaguses[identifier].state !=
            LibTypes.SarcophagusState.Exists
        ) {
            revert LibErrors.SarcophagusDoesNotExist(identifier);
        }

        // Confirm that the sarcophagus is not already finalized
        if (bytes(s.sarcophaguses[identifier].arweaveTxId).length > 0) {
            revert LibErrors.SarcophagusAlreadyFinalized(identifier);
        }

        // Set the sarcophagus state to done
        s.sarcophaguses[identifier].state = LibTypes.SarcophagusState.Done;

        address[] memory archaeologistAddresses = s
            .sarcophaguses[identifier]
            .archaeologists;

        // Re-calculate the total fees that the embalmer locked up in initializeSarcophagus
        uint256 totalFees = LibBonds.calculateTotalFees(
            identifier,
            archaeologistAddresses
        );

        // Transfer the total fees back to the embalmer
        s.sarcoToken.transfer(s.sarcophaguses[identifier].embalmer, totalFees);

        // Emit an event
        emit LibEvents.CancelSarcophagus(identifier);

        return true;
    }

    /// @notice Permanently closes the sarcophagus, giving it no opportunity to
    /// be resurrected.
    /// This may only be done after finalizeSarcophagus and before the
    /// resurrection time has passed.
    /// @dev Extends the resurrection time into infinity so that that unwrap
    /// will never be successful.
    /// @param identifier the identifier of the sarcophagus
    /// @return The boolean true if the operation was successful
    function burySarcophagus(bytes32 identifier) external returns (bool) {
        // Confirm that the sender is the embalmer
        if (s.sarcophaguses[identifier].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophaguses[identifier].embalmer
            );
        }

        // Confirm that the sarcophagus exists
        if (
            s.sarcophaguses[identifier].state !=
            LibTypes.SarcophagusState.Exists
        ) {
            revert LibErrors.SarcophagusDoesNotExist(identifier);
        }

        // Confirm that the sarcophagus is finalized by checking if there is an
        // arweaveTxId
        if (bytes(s.sarcophaguses[identifier].arweaveTxId).length == 0) {
            revert LibErrors.SarcophagusNotFinalized(identifier);
        }

        // Confirm that the current resurrection time is in the future
        if (s.sarcophaguses[identifier].resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(
                s.sarcophaguses[identifier].resurrectionTime
            );
        }

        // Set resurrection time to infinity
        s.sarcophaguses[identifier].resurrectionTime = 2**256 - 1;

        // Set sarcophagus state to done
        s.sarcophaguses[identifier].state = LibTypes.SarcophagusState.Done;

        // Total bounty will be added up when we loop through the
        // archaeologists. This will be sent back to the embalmer.
        uint256 totalBounty = 0;

        // For each archaeologist on the sarcophagus,
        // 1. Unlock their cursed bond
        // 2. Transfer digging fees to the archaeologist.
        address[] memory archaeologistAddresses = s
            .sarcophaguses[identifier]
            .archaeologists;

        for (uint256 i = 0; i < archaeologistAddresses.length; i++) {
            // Unlock the archaeologist's cursed bond
            LibBonds.freeArchaeologist(identifier, archaeologistAddresses[i]);

            LibTypes.ArchaeologistStorage
                memory archaeologistData = getArchaeologist(
                    identifier,
                    archaeologistAddresses[i]
                );

            // Transfer the digging fees to the archaeologist
            s.sarcoToken.transfer(
                archaeologistAddresses[i],
                archaeologistData.diggingFee
            );

            // Add the archaeoogist's bounty to totalBounty
            totalBounty += archaeologistData.bounty;
        }

        // Transfer the total bounty back to the embalmer (msg.sender)
        s.sarcoToken.transfer(msg.sender, totalBounty);

        // Emit an event
        emit LibEvents.BurySarcophagus(identifier);

        return true;
    }

    /// @notice Checks if the archaeologist exists on the sarcophagus.
    /// @param identifier the identifier of the sarcophagus
    /// @param archaeologist the address of the archaeologist
    /// @return The boolean true if the archaeologist exists on the sarcophagus
    function archaeologistExists(bytes32 identifier, address archaeologist)
        private
        view
        returns (bool)
    {
        // If the hashedShard on an archaeologist is 0 (which is its default
        // value), then the archaeologist doesn't exist on the sarcophagus
        return
            s
            .sarcophagusArchaeologists[identifier][archaeologist].hashedShard !=
            0;
    }

    /// @notice Gets an archaeologist given the sarcophagus identifier and the
    /// archaeologist's address.
    /// @param identifier the identifier of the sarcophagus
    /// @param archaeologist the address of the archaeologist
    /// @return The archaeologist
    function getArchaeologist(bytes32 identifier, address archaeologist)
        private
        view
        returns (LibTypes.ArchaeologistStorage memory)
    {
        return s.sarcophagusArchaeologists[identifier][archaeologist];
    }
}
