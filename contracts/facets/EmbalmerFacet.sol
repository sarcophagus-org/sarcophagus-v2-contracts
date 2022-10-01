// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract EmbalmerFacet {
    // IMPORTANT: AppStorage must be the first state variable in the facet.
    AppStorage internal s;

    event CreateSarcophagus(
        bytes32 indexed sarcoId,
        string name,
        bool canBeTransferred,
        uint256 resurrectionTime,
        address embalmer,
        address recipient,
        address[] cursedArchaeologists,
        uint256 totalDiggingFees,
        uint256 createSarcophagusProtocolFees,
        string[] arweaveTxIds
    );

    event RewrapSarcophagus(
        bytes32 indexed sarcoId,
        uint256 resurrectionTime,
        uint256 totalDiggingFees,
        uint256 rewrapSarcophagusProtocolFees
    );

    event BurySarcophagus(bytes32 indexed sarcoId);

    // Archaeologist's addresses are added to this mapping per sarcophagus to
    // verify that the same archaeologist signature is not used more than once.
    mapping(bytes32 => mapping(address => bool)) private verifiedArchaeologists;

    /// @notice Embalmer creates the sarcophagus.
    ///
    /// The purpose of createSarcophagus is to:
    ///   - Lock up payment for the selected archaeologists (digging fees)
    ///   - Store the arweave TX IDs pertaining to the encrypted file payload
    ///   -    and the encrypted shards
    ///   - Verify the selected archaeologists have signed off on the
    ///         double hash of their key share,
    ///         arweave tx id storing key shares,
    ///         and maximumRewrapInterval to be used for lifetime of the sarcophagus
    ///   - Store the selected archaeologists' addresses, digging fees and
    ///   -     unencrypted double hashes
    ///   - Curse each participating archaeologist
    ///   - Create the sarcophagus object
    ///
    /// @param sarcoId the identifier of the sarcophagus
    /// @param sarcophagus an object that contains the sarcophagus data
    /// @param selectedArchaeologists the archaeologists the embalmer has selected to curse
    /// @param arweaveTxIds ordered pair of arweave tx ids: [tx storing sarcophagus payload,
    ///         tx storing the archaeologists' encrypted key shares]
    /// @return The index of the new sarcophagus
    function createSarcophagus(
        bytes32 sarcoId,
        LibTypes.SarcophagusMemory memory sarcophagus,
        LibTypes.SelectedArchaeologistData[] memory selectedArchaeologists,
        string[] memory arweaveTxIds
    ) external returns (uint256) {
        // Confirm that this exact sarcophagus does not already exist
        if (
            s.sarcophagi[sarcoId].state !=
            LibTypes.SarcophagusState.DoesNotExist
        ) {
            revert LibErrors.SarcophagusAlreadyExists(sarcoId);
        }

        // Confirm that the resurrection time is in the future
        if (sarcophagus.resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(
                sarcophagus.resurrectionTime
            );
        }

        // Confirm that resurrection or rewrap will occur before the maximumRewrapInterval elapses
        if (sarcophagus.resurrectionTime > block.timestamp + sarcophagus.maximumRewrapInterval) {
            revert LibErrors.ResurrectionTimeTooFarInFuture(sarcophagus.resurrectionTime, sarcophagus.maximumRewrapInterval);
        }

        // Validate exactly 2 arweave TX IDs have been provided
        // TODO: See if we can verify exact byte length of arweave TXs
        if (arweaveTxIds.length != 2 || bytes(arweaveTxIds[0]).length == 0 || bytes(arweaveTxIds[1]).length == 0) {
            revert LibErrors.ArweaveTxIdsInvalid();
        }

        // Confirm that archaeologists are provided
        if (selectedArchaeologists.length == 0) {
            revert LibErrors.NoArchaeologistsProvided();
        }

        // Confirm that minShards is greater than 0
        if (sarcophagus.minShards == 0) {
            revert LibErrors.MinShardsZero();
        }

        // Confirm that minShards is less than or equal to the number of archaeologists
        // (k <= n in a shamir secret sharing scheme)
        if (sarcophagus.minShards > selectedArchaeologists.length) {
            revert LibErrors.MinShardsGreaterThanArchaeologists(
                sarcophagus.minShards
            );
        }

        // Initialize a list of archaeologist addresses to be passed in to the
        // sarcophagus object
        address[] memory cursedArchaeologists = new address[](
            selectedArchaeologists.length
        );

        uint256 totalDiggingFees = 0;

        for (uint256 i = 0; i < selectedArchaeologists.length; i++) {
            LibTypes.SelectedArchaeologistData memory arch = selectedArchaeologists[i];
            LibUtils.revertIfArchProfileDoesNotExist(arch.archAddress);

            // Confirm that the archaeologist list is unique. This is done by
            // checking that the archaeologist does not already exist from
            // previous iterations in this loop.
            if (LibUtils.archaeologistExistsOnSarc(sarcoId, arch.archAddress)) {
                revert LibErrors.ArchaeologistListNotUnique(
                    cursedArchaeologists
                );
            }

            // Validate archaeologist profile value requirements are met
            LibUtils.revertIfDiggingFeeTooLow(arch.diggingFee, arch.archAddress);

            totalDiggingFees += arch.diggingFee;

            // Validate the archaeologist has signed off on the sarcophagus parameters: double hashed key share,
            // arweaveTxId[1] (tx storing share on arweave), maximumRewrapInterval for sarcophagus
            LibUtils.verifyArchaeologistSignature(
                arch.unencryptedShardDoubleHash,
                arweaveTxIds[1],
                sarcophagus.maximumRewrapInterval,
                arch.v,
                arch.r,
                arch.s,
                arch.archAddress
            );

            LibTypes.ArchaeologistStorage memory archaeologistStorage = LibTypes
                .ArchaeologistStorage({
                    diggingFee: arch.diggingFee,
                    diggingFeesPaid: 0,
                    unencryptedShardDoubleHash: arch.unencryptedShardDoubleHash,
                    unencryptedShard: "",
                    curseTokenId: 0
                });

            // Map the double-hashed share to this archaeologist's address for easier referencing on accuse
            s.doubleHashedShardArchaeologists[arch.unencryptedShardDoubleHash] = arch
                .archAddress;

            // Save the necessary archaeologist data to the sarcophagus
            s.sarcophagusArchaeologists[sarcoId][
                arch.archAddress
            ] = archaeologistStorage;

            // Add the sarcophagus identifier to archaeologist's list of sarcophagi
            s.archaeologistSarcophagi[arch.archAddress].push(sarcoId);

            // Move free bond to cursed bond on archaeologist
            LibBonds.curseArchaeologist(sarcoId, arch.archAddress);

            // Add the archaeologist address to the list of addresses to be
            // passed in to the sarcophagus object
            cursedArchaeologists[i] = arch.archAddress;
        }

        // Create the sarcophagus object and store it in AppStorage
        s.sarcophagi[sarcoId] = LibTypes.Sarcophagus({
            name: sarcophagus.name,
            state: LibTypes.SarcophagusState.Exists,
            canBeTransferred: sarcophagus.canBeTransferred,
            minShards: sarcophagus.minShards,
            resurrectionTime: sarcophagus.resurrectionTime,
            maximumRewrapInterval: sarcophagus.maximumRewrapInterval,
            arweaveTxIds: arweaveTxIds,
            embalmer: msg.sender,
            recipientAddress: sarcophagus.recipient,
            archaeologists: cursedArchaeologists
        });

        // Add the identifier to the necessary data structures
        s.sarcophagusIdentifiers.push(sarcoId);
        s.embalmerSarcophagi[msg.sender].push(sarcoId);
        s.recipientSarcophagi[sarcophagus.recipient].push(sarcoId);

        // Transfer the total fees amount + protocol fees in sarco token from the embalmer to this contract
        uint256 protocolFees = LibUtils.calculateProtocolFees(totalDiggingFees);

        // Add the create sarcophagus protocol fee to the total protocol fees in storage
        s.totalProtocolFees += protocolFees;

        s.sarcoToken.transferFrom(
            msg.sender,
            address(this),
            totalDiggingFees + protocolFees
        );

        // Emit the event
        emit CreateSarcophagus(
            sarcoId,
            sarcophagus.name,
            sarcophagus.canBeTransferred,
            sarcophagus.resurrectionTime,
            msg.sender,
            sarcophagus.recipient,
            cursedArchaeologists,
            totalDiggingFees,
            protocolFees,
            arweaveTxIds
        );

        // Return the index of the sarcophagus
        return s.sarcophagusIdentifiers.length - 1;
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

        // Confirm current resurrection time is in future (sarcophagus is rewrappable)
        if (s.sarcophagi[sarcoId].resurrectionTime <= block.timestamp) {
            revert LibErrors.SarcophagusIsUnwrappable();
        }

        // Confirm that the new resurrection time is in the future
        if (resurrectionTime <= block.timestamp) {
            revert LibErrors.NewResurrectionTimeInPast(resurrectionTime);
        }


        // Confirm that the new resurrection time doesn't exceed the sarcophagus's maximumRewrapInterval
        if (resurrectionTime > block.timestamp + s.sarcophagi[sarcoId].maximumRewrapInterval) {
            revert LibErrors.NewResurrectionTimeTooLarge(resurrectionTime);
        }

        // For each archaeologist on the sarcophagus, transfer their digging fee allocations to them
        address[] memory bondedArchaeologists = s
            .sarcophagi[sarcoId]
            .archaeologists;

        uint256 totalDiggingFees = 0;

        for (uint256 i = 0; i < bondedArchaeologists.length; i++) {
            // Get the archaeolgist's fee data
            LibTypes.ArchaeologistStorage memory archaeologistData = LibUtils
                .getArchaeologist(sarcoId, bondedArchaeologists[i]);

            // Transfer the archaeologist's digging fee allocation to the archaeologist's reward pool
            s.archaeologistRewards[bondedArchaeologists[i]] += archaeologistData.diggingFee;

            // Add to the total of digging fees paid
            archaeologistData.diggingFeesPaid += archaeologistData.diggingFee;

            // Add the archaeologist's digging fee to the sum
            totalDiggingFees += archaeologistData.diggingFee;

            // Update the archaeologist's data in storage
            s.sarcophagusArchaeologists[sarcoId][
                bondedArchaeologists[i]
            ] = archaeologistData;
        }

        uint256 protocolFees = LibUtils.calculateProtocolFees(totalDiggingFees);

        // Add the protocol fee to the total protocol fees in storage
        s.totalProtocolFees += protocolFees;

        // Update the resurrectionTime on the sarcophagus to the supplied value
        s.sarcophagi[sarcoId].resurrectionTime = resurrectionTime;

        // Transfer the new digging fees from the embalmer to the sarcophagus contract.
        // Archaeologists may withdraw their due from their respective reward pools
        s.sarcoToken.transferFrom(
            msg.sender,
            address(this),
            totalDiggingFees + protocolFees
        );

        // Emit an event
        emit RewrapSarcophagus(sarcoId, resurrectionTime, totalDiggingFees, protocolFees);
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
            s.archaeologistRewards[bondedArchaeologists[i]] += archaeologistData.diggingFee;
        }

        // Emit an event
        emit BurySarcophagus(sarcoId);
    }
}
