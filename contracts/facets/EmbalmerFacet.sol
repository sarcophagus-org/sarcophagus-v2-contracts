// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import "../libraries/LibEvents.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract EmbalmerFacet {
    AppStorage internal s;

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
    /// @param sarcoToken The erc20 sarcophagus token
    /// @param canBeTransferred Whether the sarcophagus can be transferred
    /// @return The index of the new sarcophagus
    function initializeSarcophagus(
        string memory name,
        bytes32 identifier,
        LibTypes.ArchaeologistMemory[] memory archaeologists,
        address arweaveArchaeologist,
        address recipient,
        uint256 resurrectionTime,
        IERC20 sarcoToken,
        bool canBeTransferred
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
        require(archaeologists.length > 0, "no archaeologists provided");

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
            // Calculate the amount of cursed bond the archaeologists needs to lock up
            uint256 cursedBondAmount = LibBonds.calculateCursedBond(
                archaeologists[i].diggingFee,
                archaeologists[i].bounty
            );

            // Confirm that the archaeologist has enough free bond.
            // This error could mean that the archaeologist has either run out
            // of free bond or has never even interacted with sarcophagus.
            require(
                s.freeBonds[archaeologists[i].archAddress] >= cursedBondAmount,
                "archaeologist does not have enough free bond"
            );

            // Lock up the archaeologist's bond by the cursed bond amount
            LibBonds.lockUpBond(
                archaeologists[i].archAddress,
                cursedBondAmount
            );

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

        // Create the sarcophagus object and store it in AppStorage
        s.sarcophaguses[identifier] = LibTypes.Sarcophagus({
            name: name,
            state: LibTypes.SarcophagusState.Exists,
            canBeTransferred: canBeTransferred,
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
            archaeologists,
            storageFee
        );

        // Transfer the total fees amount in sarco token from the msg.sender to this contract
        sarcoToken.transferFrom(msg.sender, address(this), totalFees);

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
    /// @param identifier the identifier of the sarcophagus
    /// @param archaeologistSignatures the signatures of the archaeologists.
    /// This is archaeologist.length - 1 since the arweave archaeologist will be providing their own signature.
    /// @param arweaveArchaeologistSignature the signature of the archaeologist who uploaded to arweave
    /// @param arweaveTxId the arweave transaction id
    /// @param sarcoToken The erc20 sarcophagus token
    /// @return The boolean true if the operation was successful
    function finalizeSarcophagus(
        bytes32 identifier,
        LibTypes.Signature[] memory archaeologistSignatures,
        LibTypes.Signature memory arweaveArchaeologistSignature,
        string memory arweaveTxId,
        IERC20 sarcoToken
    ) external returns (bool) {
        // Confirm that the sarcophagus exists
        require(
            s.sarcophaguses[identifier].exists,
            "sarcophagus does not exist"
        );

        // Confirm that the embalmer is making this transaction
        require(
            s.sarcophaguses[identifier].embalmer == msg.sender,
            "only the embalmer can finalize the sarcophagus"
        );

        // Confirm that the sarcophagus is not already finalized by checking if
        // the arweaveTxId is empty
        require(
            bytes(s.sarcophaguses[identifier].arweaveTxId).length == 0,
            "sarcophagus already finalized"
        );

        // Confirm that the provided arweave transaction id is not empty
        require(
            bytes(arweaveTxId).length > 0,
            "arweave transaction id is empty"
        );

        // Confirm that the correct number of archaeologist signatures was sent
        // This will be archaeologist.length - 1 since the arweave archaeoligist
        // will be providing their own signature.
        require(
            archaeologistSignatures.length ==
                s.sarcophaguses[identifier].archaeologists.length - 1,
            "incorrect number of signatures"
        );

        // Iterate over each regular archaeologist signature. This will not
        // include the arweave archaeologist.
        for (uint256 i = 0; i < archaeologistSignatures.length; i++) {
            // Verify that the signature of the sarcophagus identifier came from
            // the archaeologist. This signature confirms that the archaeologist
            // approves the parameters of the sarcophagus (fees and resurrection
            // time) and is ready to work.
            LibUtils.signatureCheck(
                abi.encodePacked(identifier),
                archaeologistSignatures[i],
                s.sarcophaguses[identifier].archaeologists[i]
            );
        }

        // Verify that the signature of the arweave transaction id came from the
        // arweave archaeologist. This signature confirms that the archaeologist
        // approves the parameters of the sarcophagus (fees and resurrection
        // time) and is ready to work. The arweave archaeologist's signature in
        // particular is also used by the contract to confirm which
        // archaeologist uploaded the payload to arweave and should be paid the
        // storage fee.
        LibUtils.signatureCheck(
            abi.encodePacked(arweaveTxId),
            arweaveArchaeologistSignature,
            s.sarcophaguses[identifier].arweaveArchaeologist
        );

        // Store the arweave transaction id to the sarcophagus. The arweaveTxId
        // being populated indirectly designates the sarcophagus as finalized.
        s.sarcophaguses[identifier].arweaveTxId = arweaveTxId;

        // Transfer the storage fee to the arweave archaeologist after setting
        // the arweave transaction id.
        sarcoToken.transfer(
            s.sarcophaguses[identifier].arweaveArchaeologist,
            s.sarcophaguses[identifier].storageFee
        );

        // Emit an event
        emit LibEvents.FinalizeSarcophagus(identifier, arweaveTxId);

        return true;
    }
}
