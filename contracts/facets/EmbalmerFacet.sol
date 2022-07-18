// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibRewards} from "../libraries/LibRewards.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract EmbalmerFacet {
    // IMPORTANT: AppStorage must be the first state variable in the facet.
    AppStorage internal s;

    event InitializeSarcophagus(
        bytes32 indexed sarcoId,
        address embalmer,
        uint256 totalFees
    );

    event FinalizeSarcophagus(bytes32 indexed sarcoId, string arweaveTxId);

    event RewrapSarcophagus(
        bytes32 indexed sarcoId,
        uint256 resurrectionTime,
        uint256 resurrectionWindow
    );

    event CancelSarcophagus(bytes32 indexed sarcoId);

    event BurySarcophagus(bytes32 indexed sarcoId);

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
    /// @param archaeologists the data for the archaeologists
    /// @param arweaveArchaeologist The address of the archaeologist who uploads to arweave
    /// @param recipient the address of the recipient
    /// @param resurrectionTime the resurrection time of the sarcophagus
    /// @param maxResurrectionInterval the maximum length of time that any new resurrection times can be from time of rewrap
    /// @dev archaeologists will have to sign off on this interval, and commit to it for the lifetime of the sarcophagus.
    /// @param canBeTransferred Whether the sarcophagus can be transferred
    /// @param minShards The minimum number of shards required to unwrap the sarcophagus
    /// @return The index of the new sarcophagus
    function initializeSarcophagus(
        string memory name,
        LibTypes.ArchaeologistMemory[] memory archaeologists,
        address arweaveArchaeologist,
        address recipient,
        uint256 resurrectionTime,
        uint256 maxResurrectionInterval,
        bool canBeTransferred,
        uint8 minShards
    ) external returns (uint256) {
        bytes32 sarcoId = keccak256(abi.encodePacked(name));

        // Confirm that this exact sarcophagus does not already exist
        if (
            s.sarcophagi[sarcoId].state !=
            LibTypes.SarcophagusState.DoesNotExist
        ) {
            revert LibErrors.SarcophagusAlreadyExists(sarcoId);
        }

        // Confirm that the ressurection time is in the future
        if (resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(resurrectionTime);
        }

        // Confirm that archaeologists are provided
        if (archaeologists.length == 0) {
            revert LibErrors.NoArchaeologistsProvided();
        }

        // Confirm that minShards is less than the number of archaeologists
        if (minShards > archaeologists.length) {
            revert LibErrors.MinShardsGreaterThanArchaeologists(minShards);
        }

        // Confirm that minShards is greater than 0
        if (minShards == 0) {
            revert LibErrors.MinShardsZero();
        }

        // Confirm that maxResurrectionInterval is greater than 0
        if (maxResurrectionInterval == 0) {
            revert LibErrors.MaxResurrectionIntervalIsZero();
        }

        // Initialize a list of archaeologist addresses to be passed in to the
        // sarcophagus object
        address[] memory archaeologistsToBond = new address[](
            archaeologists.length
        );

        // Initialize the storage fee of the archaeologist who uploades to
        // arweave. This will be obtained in the for loop and stored on the
        // sarcophagus object.
        uint256 storageFee = 0;

        for (uint256 i = 0; i < archaeologists.length; i++) {
            LibTypes.ArchaeologistMemory memory arch = archaeologists[i];

            // Confirm that the archaeologist list is unique. This is done by
            // checking that the archaeologist does not already exist from
            // previous iterations in this loop.
            if (LibUtils.archaeologistExistsOnSarc(sarcoId, arch.archAddress)) {
                revert LibErrors.ArchaeologistListNotUnique(
                    archaeologistsToBond
                );
            }

            // If the archaeologist is the arweave archaeologist, set the
            // storage fee. This is the only storage fee we care about.
            if (arch.archAddress == arweaveArchaeologist) {
                storageFee = arch.storageFee;
            }

            // Define an archaeologist storage object to be stored on the sarcophagus.
            bytes32 doubleHashedShard = keccak256(abi.encode(arch.hashedShard));
            LibTypes.ArchaeologistStorage memory archaeologistStorage = LibTypes
                .ArchaeologistStorage({
                    diggingFee: arch.diggingFee,
                    bounty: arch.bounty,
                    doubleHashedShard: doubleHashedShard,
                    unencryptedShard: ""
                });

            // Map the double-hashed shared to this archaeologist's address for easier referencing on accuse
            s.doubleHashedShardArchaeologists[doubleHashedShard] = arch
                .archAddress;

            // Stores each archaeologist's bounty, digging fees, and unencrypted
            // shard in app storage per sarcophagus
            s.sarcophagusArchaeologists[sarcoId][
                arch.archAddress
            ] = archaeologistStorage;

            // Add the sarcophagus identifier to archaeologist's list of sarcophagi
            s.archaeologistSarcophagi[arch.archAddress].push(sarcoId);

            // Add the archaeologist address to the list of addresses to be
            // passed in to the sarcophagus object
            archaeologistsToBond[i] = arch.archAddress;
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
        s.sarcophagi[sarcoId] = LibTypes.Sarcophagus({
            name: name,
            state: LibTypes.SarcophagusState.Exists,
            canBeTransferred: canBeTransferred,
            minShards: minShards,
            resurrectionTime: resurrectionTime,
            resurrectionWindow: LibUtils.getGracePeriod(resurrectionTime),
            maxResurrectionInterval: maxResurrectionInterval,
            arweaveTxIds: new string[](0),
            storageFee: storageFee,
            embalmer: msg.sender,
            recipientAddress: recipient,
            arweaveArchaeologist: arweaveArchaeologist,
            archaeologists: archaeologistsToBond
        });

        // Add the identifier to the necessary data structures
        s.sarcophagusIdentifiers.push(sarcoId);
        s.embalmerSarcophagi[msg.sender].push(sarcoId);
        s.recipientSarcophagi[recipient].push(sarcoId);

        // Calculate the total fees in sarco tokens that the contract will
        // receive from the embalmer
        uint256 totalFees = LibBonds.calculateTotalFees(
            sarcoId,
            archaeologistsToBond
        );

        // Transfer the total fees amount in sarco token from the msg.sender to this contract
        s.sarcoToken.transferFrom(msg.sender, address(this), totalFees);

        // Emit the event
        emit InitializeSarcophagus(sarcoId, msg.sender, totalFees);

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
    /// @param sarcoId the identifier of the sarcophagus
    /// @param archaeologistSignatures the signatures of the archaeologists.
    /// This is archaeologist.length - 1 since the arweave archaeologist will be providing their own signature.
    /// @param arweaveArchaeologistSignature the signature of the archaeologist who uploaded to arweave
    /// @param arweaveTxId the arweave transaction id
    function finalizeSarcophagus(
        bytes32 sarcoId,
        LibTypes.SignatureWithAccount[] memory archaeologistSignatures,
        LibTypes.Signature memory arweaveArchaeologistSignature,
        string memory arweaveTxId
    ) external {
        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the embalmer is making this transaction
        if (s.sarcophagi[sarcoId].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophagi[sarcoId].embalmer
            );
        }

        // Confirm that the sarcophagus is not already finalized by checking if
        // the arweaveTxId is empty
        if (LibUtils.isSarcophagusFinalized(sarcoId)) {
            revert LibErrors.SarcophagusAlreadyFinalized(sarcoId);
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
            s.sarcophagi[sarcoId].archaeologists.length - 1
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
                verifiedArchaeologists[sarcoId][
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
                !LibUtils.archaeologistExistsOnSarc(
                    sarcoId,
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
                sarcoId,
                archaeologistSignatures[i].v,
                archaeologistSignatures[i].r,
                archaeologistSignatures[i].s,
                archaeologistSignatures[i].account
            );

            // Calculates the archaeologist's cursed bond and curses them (locks
            // up the free bond)
            LibBonds.curseArchaeologist(
                sarcoId,
                archaeologistSignatures[i].account
            );

            // Add this archaeologist to the mapping of verified archaeologists
            // so that it can't be checked again.
            verifiedArchaeologists[sarcoId][
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
            s.sarcophagi[sarcoId].arweaveArchaeologist
        );

        // Calculates the arweave archaeologist's cursed bond and curses
        // them (locks up the free bond)
        LibBonds.curseArchaeologist(
            sarcoId,
            s.sarcophagi[sarcoId].arweaveArchaeologist
        );

        // Store the arweave transaction id to the sarcophagus. The arweaveTxId
        // being populated indirectly designates the sarcophagus as finalized.
        s.sarcophagi[sarcoId].arweaveTxIds.push(arweaveTxId);

        // Transfer the storage fee to the arweave archaeologist's reward pool
        // after setting the arweave transaction id.
        // TODO: Discuss, confirm if this is okay:
        // Is there value in directly transferring the storage fee to the
        // archaeologist on finalise?
        LibRewards.increaseRewardPool(
            s.sarcophagi[sarcoId].arweaveArchaeologist,
            s.sarcophagi[sarcoId].storageFee
        );

        // Emit an event
        emit FinalizeSarcophagus(sarcoId, arweaveTxId);
    }

    /// @notice The embalmer may extend the life of the sarcophagus as long as
    /// the resurrection time has not passed yet.
    /// @dev The embalmer sets a new resurrection time sometime in the future.
    /// @param sarcoId the identifier of the sarcophagus
    /// @param resurrectionTime the new resurrection time
    function rewrapSarcophagus(bytes32 sarcoId, uint256 resurrectionTime)
        external
    {
        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the sender is the embalmer
        if (s.sarcophagi[sarcoId].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophagi[sarcoId].embalmer
            );
        }

        // Confirm that the sarcophagus is finalized
        if (!LibUtils.isSarcophagusFinalized(sarcoId)) {
            revert LibErrors.SarcophagusNotFinalized(sarcoId);
        }

        // Confirm that the current resurrection time is in the future
        if (s.sarcophagi[sarcoId].resurrectionTime <= block.timestamp) {
            revert LibErrors.NewResurrectionTimeInPast(
                s.sarcophagi[sarcoId].resurrectionTime
            );
        }

        // Confirm that the new resurrection time is in the future
        if (resurrectionTime <= block.timestamp) {
            revert LibErrors.NewResurrectionTimeInPast(resurrectionTime);
        }

        // Calculate the new resurrectionWindow, which is the amount of time in
        // seconds that an archaeologist has to unwrap after the resurrection
        // time has passed.
        uint256 resurrectionWindow = LibUtils.getGracePeriod(resurrectionTime);

        // Store the new resurrectionTime and resurrectionWindow
        s.sarcophagi[sarcoId].resurrectionTime = resurrectionTime;
        s.sarcophagi[sarcoId].resurrectionWindow = resurrectionWindow;

        // For each archaeologist on the sarcophagus, transfer their digging fee allocations to them
        address[] memory bondedArchaeologists = s
            .sarcophagi[sarcoId]
            .archaeologists;

        uint256 diggingFeeSum = 0;

        for (uint256 i = 0; i < bondedArchaeologists.length; i++) {
            // Get the archaeolgist's fee data
            LibTypes.ArchaeologistStorage memory archaeologistData = LibUtils
                .getArchaeologist(sarcoId, bondedArchaeologists[i]);

            // Transfer the archaeologist's digging fee allocation to the archaeologist's reward pool
            LibRewards.increaseRewardPool(
                bondedArchaeologists[i],
                archaeologistData.diggingFee
            );

            // Add the archaeologist's digging fee to the sum
            diggingFeeSum += archaeologistData.diggingFee;
        }

        uint256 protocolFee = LibUtils.calculateProtocolFee();

        // Add the protocol fee to the total protocol fees in storage
        s.totalProtocolFees += protocolFee;

        // Transfer the new digging fees from the embalmer to the sarcophagus contract.
        // Archaeologists may withdraw their due from their respective reward pools
        s.sarcoToken.transferFrom(
            msg.sender,
            address(this),
            diggingFeeSum + protocolFee
        );

        // Emit an event
        emit RewrapSarcophagus(sarcoId, resurrectionTime, resurrectionWindow);
    }

    /// @notice Cancels a sarcophagus. An embalmer may cancel a sarcophagus after
    /// `initializeSarcophagus` but before `finalizeSarcophagus`. The embalmer's
    /// fees that were locked up will be refunded.
    /// @param sarcoId the identifier of the sarcophagus
    function cancelSarcophagus(bytes32 sarcoId) external {
        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the sender is the embalmer
        if (s.sarcophagi[sarcoId].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophagi[sarcoId].embalmer
            );
        }

        // Confirm that the sarcophagus is not already finalized
        if (LibUtils.isSarcophagusFinalized(sarcoId)) {
            revert LibErrors.SarcophagusAlreadyFinalized(sarcoId);
        }

        // Set the sarcophagus state to done
        s.sarcophagi[sarcoId].state = LibTypes.SarcophagusState.Done;

        address[] memory bondedArchaeologists = s
            .sarcophagi[sarcoId]
            .archaeologists;

        // Re-calculate the total fees that the embalmer locked up in initializeSarcophagus
        uint256 totalFees = LibBonds.calculateTotalFees(
            sarcoId,
            bondedArchaeologists
        );

        // Transfer the total fees back to the embalmer
        s.sarcoToken.transfer(s.sarcophagi[sarcoId].embalmer, totalFees);

        // Emit an event
        emit CancelSarcophagus(sarcoId);
    }

    /// @notice Permanently closes the sarcophagus, giving it no opportunity to
    /// be resurrected.
    /// This may only be done after finalizeSarcophagus and before the
    /// resurrection time has passed.
    /// @dev Extends the resurrection time into infinity so that that unwrap
    /// will never be successful.
    /// @param sarcoId the identifier of the sarcophagus
    function burySarcophagus(bytes32 sarcoId) external {
        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the sender is the embalmer
        if (s.sarcophagi[sarcoId].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophagi[sarcoId].embalmer
            );
        }

        // Confirm that the sarcophagus is finalized by checking if there is an
        // arweaveTxId
        if (!LibUtils.isSarcophagusFinalized(sarcoId)) {
            revert LibErrors.SarcophagusNotFinalized(sarcoId);
        }

        // Confirm that the current resurrection time is in the future
        if (s.sarcophagi[sarcoId].resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(
                s.sarcophagi[sarcoId].resurrectionTime
            );
        }

        // Set resurrection time to infinity
        s.sarcophagi[sarcoId].resurrectionTime = 2**256 - 1;

        // Set sarcophagus state to done
        s.sarcophagi[sarcoId].state = LibTypes.SarcophagusState.Done;

        // Total bounty will be added up when we loop through the
        // archaeologists. This will be sent back to the embalmer.
        uint256 totalBounty = 0;

        // For each archaeologist on the sarcophagus,
        // 1. Unlock their cursed bond
        // 2. Transfer digging fees to the archaeologist.
        address[] memory bondedArchaeologists = s
            .sarcophagi[sarcoId]
            .archaeologists;

        for (uint256 i = 0; i < bondedArchaeologists.length; i++) {
            // Unlock the archaeologist's cursed bond
            LibBonds.freeArchaeologist(sarcoId, bondedArchaeologists[i]);

            LibTypes.ArchaeologistStorage memory archaeologistData = LibUtils
                .getArchaeologist(sarcoId, bondedArchaeologists[i]);

            // Transfer the digging fees to the archaeologist's reward pool
            LibRewards.increaseRewardPool(
                bondedArchaeologists[i],
                archaeologistData.diggingFee
            );

            // Add the archaeoogist's bounty to totalBounty
            totalBounty += archaeologistData.bounty;
        }

        // Transfer the total bounty back to the embalmer (msg.sender)
        s.sarcoToken.transfer(msg.sender, totalBounty);

        // Emit an event
        emit BurySarcophagus(sarcoId);
    }
}
