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

    /// @notice Emitted when a sarcophagus is created
    /// @param sarcoId Id of the new sarcophagus
    /// @param name Name of the new sarcophagus
    /// @param resurrectionTime Resurrection time of the new sarcophagus
    /// @param embalmer Address of embalmer
    /// @param recipient Address of recipient
    /// @param cursedArchaeologists Array of addresses of cursed archaeologists
    /// @param totalDiggingFees Total digging fees charged to embalmer to create the sarcophagus
    /// @param createSarcophagusProtocolFees Total protocol fees charged to embalmer to create the sarcophagus
    /// @param arweaveTxIds arweaveTxIds ordered pair of arweave tx ids for the sarcophagus: [sarcophagus payload tx, encrypted key share tx]
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

    /// @notice Emitted when a sarcophagus is rewrapped
    /// @param sarcoId Id of sarcophagus that was buried
    /// @param resurrectionTime New resurrection time for the sarcophagus
    /// @param totalDiggingFees Total digging fees charged to the embalmer for the rewrap
    /// @param rewrapSarcophagusProtocolFees Total protocol fees charged to the embalmer for the rewrap
    event RewrapSarcophagus(
        bytes32 indexed sarcoId,
        uint256 resurrectionTime,
        uint256 totalDiggingFees,
        uint256 rewrapSarcophagusProtocolFees
    );

    /// @notice Emitted when a sarcophagus is buried
    /// @param sarcoId Id of sarcophagus that was buried
    event BurySarcophagus(bytes32 indexed sarcoId);

    /// @notice Parameters of a sarcophagus, supplied during sarcophagus creation
    struct SarcophagusParams {
        string name;
        // highest rewrap interval bonded archaeologists have agreed to accept for lifetime of sarcophagus
        uint256 maximumRewrapInterval;
        address recipientAddress;
        uint256 resurrectionTime;
        uint8 threshold;
        uint256 creationTime;
    }

    /// @notice Parameters of an archaeologist's curse, supplied during sarcophagus creation
    struct SelectedArchaeologistData {
        bytes publicKey;
        address archAddress;
        // diggingFee archaeologist has agreed to receive on sarcophagus for its entire lifetime
        uint256 diggingFee;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// @notice Emitted when an embalmer attempts to create a sarcophagus with an id that is already in use
    /// @param sarcoId Id that is already in use
    error SarcophagusAlreadyExists(bytes32 sarcoId);

    /// @notice Emitted when an embalmer attempts to create a sarcophagus with expired parameters
    /// @param currentTime Timestamp of the failed create attempt
    /// @param creationTime Time when the sarcophagus parameters were created
    /// @param creationDeadline Deadline for creation of a sarcophagus with the supplied parameters
    error SarcophagusParametersExpired(
        uint256 currentTime,
        uint256 creationTime,
        uint256 creationDeadline
    );

    /// @notice Emitted when an embalmer attempts to create a sarcophagus with no archaeologists
    error NoArchaeologistsProvided();
    /// @notice Emitted when an embalmer attempts to create a sarcophagus with a shamir secret sharing threshold of 0
    error ThresholdCannotBeZero();

    error ThresholdGreaterThanTotalNumberOfArchaeologists(
        uint8 threshold,
        uint256 totalNumberOfArchaeologists
    );

    error ArchaeologistListContainsDuplicate(address archaeologistAddress);

    /// @notice Emitted when an embalmer attempts to rewrap a sarcophagus with a resurrection time that has already passed
    /// @param currentTime Timestamp of the failed rewrap attempt
    /// @param resurrectionTime Resurrection timestamp which has already passed
    error ResurrectionTimeInPast(uint256 currentTime, uint256 resurrectionTime);

    /// @notice Emitted when an embalmer attempts to rewrap a sarcophagus with a resurrection time that exceeds the maximum rewrap interval
    /// @param resurrectionTime Resurrection timestamp which is too far in the future
    /// @param sarcophagusMaximumRewrapInterval Maximum rewrap interval set for the sarcophagus
    /// @param maximumPermissibleResurrectionTime Resurrection timestamp which is too far in the future
    error ResurrectionTimeTooFarInFuture(
        uint256 resurrectionTime,
        uint256 sarcophagusMaximumRewrapInterval,
        uint256 maximumPermissibleResurrectionTime
    );

    error NewResurrectionTimeInPast(uint256 currentTime, uint256 newResurrectionTime);

    error NewResurrectionTimeTooFarInFuture(
        uint256 resurrectionTime,
        uint256 sarcophagusMaximumRewrapInterval,
        uint256 maximumPermissibleResurrectionTime
    );

    /// @notice Creates a sarcophagus with the supplied parameters and locks
    /// a portion of each archaeologist's freeBond equal to the diggingFees for the sarcophagus.
    /// Verifies that all supplied archaeologists have signed off on the sarcophagus negotiation parameters:
    ///    - publicKey key they are responsible for
    ///    - maximumRewrapInterval to be enforced for the lifetime of the sarcophagus
    ///    - creationTime of sarcophagus
    ///    - diggingFee to be paid to that archaeologist on all rewraps for the lifetime of the sarcophagus
    ///
    /// @param sarcoId the identifier of the sarcophagus
    /// @param sarcophagusParams params to set on sarcophagus being created
    /// @param selectedArchaeologists the archaeologists the embalmer has selected to curse
    /// @param arweaveTxIds ordered pair of arweave tx ids: [sarcophagus payload tx, encrypted key share tx]
    function createSarcophagus(
        bytes32 sarcoId,
        SarcophagusParams calldata sarcophagusParams,
        SelectedArchaeologistData[] calldata selectedArchaeologists,
        string[2] memory arweaveTxIds
    ) external {
        // Confirm that sarcophagus with supplied id doesn't already exist
        if (s.sarcophagi[sarcoId].resurrectionTime > 0) {
            revert SarcophagusAlreadyExists(sarcoId);
        }

        // Confirm that agreed upon sarcophagus parameters have not expired
        if (block.timestamp > sarcophagusParams.creationTime + s.expirationThreshold) {
            revert SarcophagusParametersExpired(
                block.timestamp,
                sarcophagusParams.creationTime,
                sarcophagusParams.creationTime + s.expirationThreshold
            );
        }

        // Confirm that resurrection time is in the future
        if (block.timestamp >= sarcophagusParams.resurrectionTime) {
            revert ResurrectionTimeInPast(block.timestamp, sarcophagusParams.resurrectionTime);
        }

        // Confirm that resurrection or rewrap will occur before the maximumRewrapInterval elapses
        if (
            block.timestamp + sarcophagusParams.maximumRewrapInterval <
            sarcophagusParams.resurrectionTime
        ) {
            revert ResurrectionTimeTooFarInFuture(
                sarcophagusParams.resurrectionTime,
                sarcophagusParams.maximumRewrapInterval,
                block.timestamp + sarcophagusParams.maximumRewrapInterval
            );
        }

        // Confirm that archaeologists are provided
        if (selectedArchaeologists.length == 0) {
            revert NoArchaeologistsProvided();
        }
        // Confirm that threshold is greater than 0
        if (sarcophagusParams.threshold == 0) {
            revert ThresholdCannotBeZero();
        }
        // Confirm that threshold is less than or equal to the number of archaeologists
        // (k <= n in a shamir secret sharing scheme)
        if (sarcophagusParams.threshold > selectedArchaeologists.length) {
            revert ThresholdGreaterThanTotalNumberOfArchaeologists(
                sarcophagusParams.threshold,
                selectedArchaeologists.length
            );
        }

        // create the sarcophagus
        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];
        sarcophagus.name = sarcophagusParams.name;
        sarcophagus.threshold = sarcophagusParams.threshold;
        sarcophagus.resurrectionTime = sarcophagusParams.resurrectionTime;
        sarcophagus.maximumRewrapInterval = sarcophagusParams.maximumRewrapInterval;
        sarcophagus.arweaveTxIds = arweaveTxIds;
        sarcophagus.embalmerAddress = msg.sender;
        sarcophagus.recipientAddress = sarcophagusParams.recipientAddress;
        sarcophagus.cursedArchaeologistAddresses = new address[](selectedArchaeologists.length);

        // track total digging fees due upon creation of sarcophagus
        uint256 totalDiggingFees = 0;

        for (uint256 i = 0; i < selectedArchaeologists.length; i++) {
            // confirm archaeologist is registered
            LibUtils.revertIfArchProfileDoesNotExist(selectedArchaeologists[i].archAddress);

            // Confirm archaeologist isn't already cursed on sarcophagus
            if (
                sarcophagus
                    .cursedArchaeologists[selectedArchaeologists[i].archAddress]
                    .publicKey
                    .length != 0
            ) {
                revert ArchaeologistListContainsDuplicate(selectedArchaeologists[i].archAddress);
            }

            // todo: check convenience structure for public keys that have already been used

            // todo: verify that the sarcophagus parameters have been signed with the private key corresponding to the supplied public key

            totalDiggingFees += selectedArchaeologists[i].diggingFee;

            // Lock the archaeologist's free bond
            LibBonds.lockUpBond(
                selectedArchaeologists[i].archAddress,
                selectedArchaeologists[i].diggingFee
            );

            // save the cursedArchaeologist and cursedArchaeologistAddress to be stored on the new sarcophagus
            sarcophagus.cursedArchaeologists[selectedArchaeologists[i].archAddress] = LibTypes
                .CursedArchaeologist({
                    publicKey: selectedArchaeologists[i].publicKey,
                    privateKey: 0,
                    isAccused: false,
                    diggingFee: selectedArchaeologists[i].diggingFee
                });

            sarcophagus.cursedArchaeologistAddresses[i] = selectedArchaeologists[i].archAddress;

            // update archaeologist-specific convenience lookup structures
            s.publicKeyToArchaeologistAddress[
                selectedArchaeologists[i].publicKey
            ] = selectedArchaeologists[i].archAddress;
            s.archaeologistSarcophagi[selectedArchaeologists[i].archAddress].push(sarcoId);
        }

        // update sarcophagus-specific convenience lookup structures
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
            sarcophagus.cursedArchaeologistAddresses,
            totalDiggingFees,
            protocolFees,
            arweaveTxIds
        );
    }

    /// @notice Updates the resurrectionTime on a sarcophagus. Callable by the embalmer of a sarcophagus if its
    /// resurrection time has not passed, it has not been compromised by k or more accusals, and it has not been buried.
    /// @param sarcoId the identifier of the sarcophagus
    /// @param resurrectionTime the new resurrection time
    function rewrapSarcophagus(bytes32 sarcoId, uint256 resurrectionTime) external {
        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];

        // Confirm the sarcophagus exists
        if (sarcophagus.resurrectionTime == 0) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm the sarcophagus has not been compromised
        if (sarcophagus.isCompromised) {
            revert LibErrors.SarcophagusCompromised(sarcoId);
        }

        // Confirm the sarcophagus is not buried
        if (sarcophagus.resurrectionTime == 2 ** 256 - 1) {
            revert LibErrors.SarcophagusInactive(sarcoId);
        }

        // Confirm tx sender is embalmer
        if (sarcophagus.embalmerAddress != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(msg.sender, sarcophagus.embalmerAddress);
        }

        // Confirm resurrection time has not yet passed
        if (block.timestamp >= sarcophagus.resurrectionTime) {
            revert ResurrectionTimeInPast(block.timestamp, sarcophagus.resurrectionTime);
        }

        // Confirm that new resurrection time is in future
        if (block.timestamp >= resurrectionTime) {
            revert NewResurrectionTimeInPast(block.timestamp, resurrectionTime);
        }

        // Confirm that new resurrection time doesn't exceed sarcophagus's maximumRewrapInterval
        if (block.timestamp + sarcophagus.maximumRewrapInterval < resurrectionTime) {
            revert NewResurrectionTimeTooFarInFuture(
                resurrectionTime,
                sarcophagus.maximumRewrapInterval,
                block.timestamp + sarcophagus.maximumRewrapInterval
            );
        }

        // track total digging fees across all archaeologists on the sarcophagus
        uint256 totalDiggingFees = 0;

        // pay digging fee to each cursed archaeologist on the sarcophagus that has not been accused
        address[] storage archaeologistAddresses = sarcophagus.cursedArchaeologistAddresses;
        for (uint256 i = 0; i < archaeologistAddresses.length; i++) {
            LibTypes.CursedArchaeologist storage cursedArchaeologist = sarcophagus
                .cursedArchaeologists[archaeologistAddresses[i]];

            // if the archaeologist hasn't been accused transfer them their digging fees
            if (!cursedArchaeologist.isAccused) {
                s.archaeologistRewards[archaeologistAddresses[i]] += cursedArchaeologist.diggingFee;
                totalDiggingFees += cursedArchaeologist.diggingFee;
            }
        }

        uint256 protocolFees = LibUtils.calculateProtocolFees(totalDiggingFees);

        // Add the protocol fee to the total protocol fees in storage
        s.totalProtocolFees += protocolFees;

        // Update the resurrectionTime on the sarcophagus to the supplied value
        sarcophagus.resurrectionTime = resurrectionTime;

        // Transfer the new digging fees and protocol fees from embalmer to contract
        s.sarcoToken.transferFrom(msg.sender, address(this), totalDiggingFees + protocolFees);

        emit RewrapSarcophagus(sarcoId, resurrectionTime, totalDiggingFees, protocolFees);
    }

    /// @notice Terminates a sarcophagus by setting its resurrection time to infinity and returning locked
    /// bonds to all innocent cursed archaeologists. Callable by the embalmer of a sarcophagus if its
    /// resurrection time has not passed, it has not been compromised by k or more accusals, and it has not been buried.
    /// @param sarcoId the identifier of the sarcophagus
    function burySarcophagus(bytes32 sarcoId) external {
        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];

        // Confirm the sarcophagus exists
        if (sarcophagus.resurrectionTime == 0) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm the sarcophagus has not been compromised
        if (sarcophagus.isCompromised) {
            revert LibErrors.SarcophagusCompromised(sarcoId);
        }

        // Confirm the sarcophagus is not buried
        if (sarcophagus.resurrectionTime == 2 ** 256 - 1) {
            revert LibErrors.SarcophagusInactive(sarcoId);
        }

        // Confirm tx sender is embalmer
        if (sarcophagus.embalmerAddress != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(msg.sender, sarcophagus.embalmerAddress);
        }
        // Confirm that the current resurrection time is in the future
        if (block.timestamp >= sarcophagus.resurrectionTime) {
            revert ResurrectionTimeInPast(block.timestamp, sarcophagus.resurrectionTime);
        }

        // Set resurrection time to infinity
        sarcophagus.resurrectionTime = 2 ** 256 - 1;

        // for each archaeologist on the sarcophagus, unlock bond and pay digging fees
        address[] storage archaeologistAddresses = sarcophagus.cursedArchaeologistAddresses;
        for (uint256 i = 0; i < archaeologistAddresses.length; i++) {
            LibTypes.CursedArchaeologist storage cursedArchaeologist = sarcophagus
                .cursedArchaeologists[archaeologistAddresses[i]];
            // if the archaeologist hasn't been accused transfer them their digging fees and return their locked bond
            if (!cursedArchaeologist.isAccused) {
                s.archaeologistRewards[archaeologistAddresses[i]] += cursedArchaeologist.diggingFee;
                LibBonds.freeArchaeologist(sarcoId, archaeologistAddresses[i]);
            }
        }

        emit BurySarcophagus(sarcoId);
    }
}
