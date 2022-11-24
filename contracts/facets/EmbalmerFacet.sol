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
        uint256 resurrectionTime,
        address embalmer,
        address recipient,
        address[] cursedArchaeologists,
        uint256 totalDiggingFees,
        uint256 createSarcophagusProtocolFees,
        string[2] arweaveTxIds
    );

    event RewrapSarcophagus(
        bytes32 indexed sarcoId,
        uint256 resurrectionTime,
        uint256 totalDiggingFees,
        uint256 rewrapSarcophagusProtocolFees
    );

    event BurySarcophagus(bytes32 indexed sarcoId);

    /**
    * Parameters for a sarcophagus, supplied during creation
    * maximumRewrapInterval - highest rewrap interval bonded archaeologists have agreed to accept for lifetime of sarcophagus
    */
    struct SarcophagusParams {
        string name;
        address recipientAddress;
        uint256 resurrectionTime;
        uint256 maximumRewrapInterval;
        uint8 threshold;
        uint256 timestamp;
    }

    /**
    * Parameters for an archaeologist's curse, supplied during sarcophagus creation
    * diggingFee - diggingFee archaeologist has agreed to receive on sarcophagus for its entire lifetime
    */
    struct SelectedArchaeologistData {
        address archAddress;
        uint256 diggingFee;
        bytes32 doubleHashedKeyShare;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

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
    /// @param sarcophagusParams params to set on sarcophagus being created
    /// @param selectedArchaeologists the archaeologists the embalmer has selected to curse
    /// @param arweaveTxIds ordered pair of arweave tx ids: [sarcophagus payload tx, encrypted key share tx]
    /// @return The index of the new sarcophagus in sarcophagusIdentifiers
    function createSarcophagus(
        bytes32 sarcoId,
        SarcophagusParams calldata sarcophagusParams,
        SelectedArchaeologistData[] calldata selectedArchaeologists,
        string[2] calldata arweaveTxIds
    ) external returns (uint256) {
        // Confirm that sarcophagus with supplied id doesn't already exist
        if (!s.sarcophagi[sarcoId].embalmerAddress) {
            revert LibErrors.SarcophagusAlreadyExists(sarcoId);
        }

        // Confirm that agreed upon sarcophagus parameters have not expired
        if (sarcophagusParams.timestamp + s.expirationThreshold < block.timestamp) {
            revert LibErrors.SarcophagusParametersExpired(sarcophagusParams.timestamp);
        }

        // Confirm that resurrection time is in the future
        if (sarcophagusParams.resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(sarcophagusParams.resurrectionTime);
        }

        // Confirm that resurrection or rewrap will occur before the maximumRewrapInterval elapses
        if (sarcophagusParams.resurrectionTime > block.timestamp + sarcophagusParams.maximumRewrapInterval) {
            revert LibErrors.ResurrectionTimeTooFarInFuture(sarcophagusParams.resurrectionTime, sarcophagusParams.maximumRewrapInterval);
        }

        // todo: we may not need to validate k and n, is the embalmer hurting anybody by themselves by setting incorrect k/n values?
        // Confirm that archaeologists are provided
        if (selectedArchaeologists.length == 0) {revert LibErrors.NoArchaeologistsProvided();}
        // Confirm that minShards is greater than 0
        if (sarcophagusParams.threshold == 0) {revert LibErrors.MinShardsZero();}
        // Confirm that minShards is less than or equal to the number of archaeologists
        // (k <= n in a shamir secret sharing scheme)
        if (sarcophagusParams.threshold > selectedArchaeologists.length) {revert LibErrors.MinShardsGreaterThanArchaeologists(sarcophagusParams.threshold);}

        // init array of addresses and mapping of address => CursedArchaeologist for archaeologists cursed on sarcophagus, to be stored on object
        address[] memory cursedArchaeologistAddresses = new address[](selectedArchaeologists.length);
        mapping(address => CursedArchaeologist) memory cursedArchaeologists;

        // track total digging fees due upon creation of sarcophagus
        uint256 totalDiggingFees = 0;

        for (uint256 i = 0; i < selectedArchaeologists.length; i++) {
            // confirm archaeologist is registered
            LibUtils.revertIfArchProfileDoesNotExist(selectedArchaeologists[i].archAddress);

            // Confirm archaeologist isn't already cursed on sarcophagus
            // todo: may be unnecessary, is cursing an archaeologist twice harming anybody but the caller?
            if (!cursedArchaeologists[selectedArchaeologists[i].archAddress].doubleHashedKeyShare) {
                revert LibErrors.ArchaeologistListNotUnique(cursedArchaeologistAddresses);
            }

            // Validate the archaeologist has signed off on the sarcophagus parameters
            LibUtils.verifyArchaeologistSignature(
                selectedArchaeologists[i].unencryptedShardDoubleHash,
                arweaveTxIds[1],
                sarcophagusParams.maximumRewrapInterval,
                sarcophagusParams.timestamp,
                selectedArchaeologists[i].diggingFee,
                selectedArchaeologists[i].v,
                selectedArchaeologists[i].r,
                selectedArchaeologists[i].s,
                selectedArchaeologists[i].archAddress
            );

            totalDiggingFees += selectedArchaeologists[i].diggingFee;

            // Move free bond to cursed bond on archaeologist
            LibBonds.curseArchaeologist(sarcoId, selectedArchaeologists[i].archAddress);

            // save the cursedArchaeologist and cursedArchaeologistAddress to be stored on the new sarcophagus
            cursedArchaeologists[selectedArchaeologists[i].archAddress] = LibTypes.CursedArchaeologist({
            isAccused : false,
            diggingFee : selectedArchaeologists[i].diggingFee,
            doubleHashedKeyShare : selectedArchaeologists[i].doubleHashedKeyShare,
            rawKeyShare : ""
            });
            cursedArchaeologistAddresses[i] = selectedArchaeologists[i].archAddress;

            // update archaeologist-specific convenience lookup structures
            s.doubleHashedShardArchaeologists[selectedArchaeologists[i].doubleHashedKeyShare] = selectedArchaeologists[i].archAddress;
            s.archaeologistSarcophagi[selectedArchaeologists[i].archAddress].push(sarcoId);
        }

        // save the sarcophagus
        s.sarcophagi[sarcoId] = LibTypes.Sarcophagus({
        name : sarcophagusParams.name,
        threshold : sarcophagusParams.threshold,
        resurrectionTime : sarcophagusParams.resurrectionTime,
        maximumRewrapInterval : sarcophagusParams.maximumRewrapInterval,
        arweaveTxIds : arweaveTxIds,
        embalmerAddress : msg.sender,
        recipientAddress : sarcophagusParams.recipientAddress,
        archaeologistAddresses : cursedArchaeologistAddresses,
        cursedArchaeologists : cursedArchaeologists
        });

        // update sarcophagus-specific convenience lookup structures
        s.sarcophagusIdentifiers.push(sarcoId);
        s.embalmerSarcophagi[msg.sender].push(sarcoId);
        s.recipientSarcophagi[sarcophagusParams.recipientAddress].push(sarcoId);

        // Transfer totalDiggingFees and the protocolFees in SARCO from embalmer to this contract
        uint256 protocolFees = LibUtils.calculateProtocolFees(totalDiggingFees);
        s.totalProtocolFees += protocolFees;
        s.sarcoToken.transferFrom(msg.sender, address(this), totalDiggingFees + protocolFees);

        emit CreateSarcophagus(
            sarcoId,
            sarcophagusParams.name,
            sarcophagusParams.resurrectionTime,
            msg.sender,
            sarcophagusParams.recipientAddress,
            cursedArchaeologistAddresses,
            totalDiggingFees,
            protocolFees,
            arweaveTxIds
        );

        // return index of sarcophagus in sarcophagusIdentifiers
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
        LibUtils.revertIfNotExistOrInactive(sarcoId);

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
    /// This may only be done before resurrection time has passed.
    /// @dev Extends the resurrection time into infinity so that that unwrap
    /// will never be successful.
    /// @param sarcoId the identifier of the sarcophagus
    function burySarcophagus(bytes32 sarcoId) external {
        LibUtils.revertIfNotExistOrInactive(sarcoId);

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
        s.sarcophagi[sarcoId].resurrectionTime = 2 ** 256 - 1;

        // Set sarcophagus state to done
        s.sarcophagi[sarcoId].state = LibTypes.SarcophagusState.Buried;

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
