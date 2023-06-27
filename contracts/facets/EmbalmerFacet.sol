// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../libraries/LibTypes.sol";
import "../storage/LibAppStorage.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";

contract EmbalmerFacet {
    /// @notice Emitted when a sarcophagus is created
    /// @param sarcoId Id of the new sarcophagus
    /// @param name Name of the new sarcophagus
    /// @param resurrectionTime Resurrection time of the new sarcophagus
    /// @param creationTime Creation time as set during negotiation, not the same as blocktime at which event is emitted
    /// @param embalmer Address of embalmer
    /// @param recipient Address of recipient
    /// @param cursedArchaeologists Array of addresses of cursed archaeologists
    /// @param totalDiggingFees Total digging fees charged to embalmer to create the sarcophagus
    /// @param arweaveTxId arweave tx id for the sarcophagus
    event CreateSarcophagus(
        bytes32 indexed sarcoId,
        string name,
        uint256 resurrectionTime,
        uint256 creationTime,
        address embalmer,
        address recipient,
        address[] cursedArchaeologists,
        uint256 totalDiggingFees,
        string arweaveTxId
    );

    /// @notice Emitted when a sarcophagus is rewrapped
    /// @param sarcoId Id of sarcophagus that was rewrapped
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
        // highest rewrap interval cursed archaeologists have agreed to accept for lifetime of sarcophagus
        uint256 maximumRewrapInterval;
        // The timestamp beyond which the sarcophagus can no longer be rewrapped
        uint256 maximumResurrectionTime;
        address recipientAddress;
        uint256 resurrectionTime;
        uint8 threshold;
        uint256 creationTime;
    }

    /// @notice Parameters of an archaeologist's curse, supplied during sarcophagus creation
    struct CurseParams {
        bytes publicKey;
        address archAddress;
        uint256 diggingFeePerSecond;
        uint256 curseFee;
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

    /// @notice Emitted when an embalmer attempts to create a sarcophagus with more required archaeologists than total archaeologists
    error ThresholdGreaterThanTotalNumberOfArchaeologists(
        uint8 threshold,
        uint256 totalNumberOfArchaeologists
    );

    /// @notice Emitted when an embalmer attempts to create a sarcophagus with an archaeologist list that contains the same archaeologist more than once
    error ArchaeologistListContainsDuplicate(address archaeologistAddress);

    /// @notice Emitted when an embalmer attempts to rewrap a sarcophagus with a resurrection time that has already passed
    /// @param currentTime Timestamp of the failed rewrap attempt
    /// @param resurrectionTime Resurrection timestamp which has already passed
    error ResurrectionTimeInPast(uint256 currentTime, uint256 resurrectionTime);

    /// @notice Emitted when an embalmer attempts to create a sarcophagus with a public key that has already been assigned to another sarcophagus
    /// @param publicKey the duplicated public key
    error DuplicatePublicKey(bytes publicKey);

    /// @notice Emitted when an embalmer attempts to rewrap a sarcophagus with a resurrection time that exceeds the maximum rewrap interval
    /// @param resurrectionTime Resurrection timestamp which is too far in the future
    /// @param sarcophagusMaximumRewrapInterval Maximum rewrap interval set for the sarcophagus
    /// @param maximumPermissibleResurrectionTime Resurrection timestamp which is too far in the future
    error ResurrectionTimeTooFarInFuture(
        uint256 resurrectionTime,
        uint256 sarcophagusMaximumRewrapInterval,
        uint256 maximumPermissibleResurrectionTime
    );

    /// @notice Emitted when the resurrection time defined during sarcohpagus creation or rewrap goes past the max resurrection time
    /// @param resurrectionTime The resurrection time defined during the sarcophagus creation or rewrap
    /// @param maxResurrectionTime The maximum allowed resurrection time
    error ResurrectionTimePastMaxResurrectionTime(
        uint256 resurrectionTime,
        uint256 maxResurrectionTime
    );

    error NewResurrectionTimeInPast(uint256 currentTime, uint256 newResurrectionTime);

    error NewResurrectionTimeIsZero();

    error NewResurrectionTimeTooFarInFuture(
        uint256 resurrectionTime,
        uint256 sarcophagusMaximumRewrapInterval,
        uint256 maximumPermissibleResurrectionTime
    );

    error ResurrectionTimeTooFarPastPreviousResurrectionTime(
        uint256 resurrectionTime,
        uint256 previousResurrectionTime
    );

    /// @notice Creates a sarcophagus with the supplied parameters and locks
    /// a portion of each archaeologist's freeBond equal to the digging fees calculated for the duration
    /// of the sarcophagus until its resurrection time.
    ///
    /// Verifies that each supplied archaeologist has signed off on the sarcophagus negotiation parameters:
    ///    - `publicKey` that matches the private key the archaeologist is responsible for
    ///    - `maximumRewrapInterval` to be enforced for the lifetime of the sarcophagus. No new resurrection time for future rewraps may exceed this interval from time of rewrap.
    ///    - `creationTime` of sarcophagus
    ///    - `diggingFeePerSecond` agreed to be paid to the archaeologist during the lifetime of the sarcophagus. Paid per rewrap and publishPrivateKey. Constant.
    ///    - `curseFee` agreed to be paid to the archaeologist once during the lifetime of the sarcophagus to cover cost of publishPrivateKey tx. Paid either on first rewrap or publishPrivateKey if no rewrap has occurred Constant.
    ///
    /// @param sarcoId the identifier of the sarcophagus
    /// @param sarcophagusParams params to set on sarcophagus being created
    /// @param selectedArchaeologists the archaeologists the embalmer has selected to curse
    /// @param arweaveTxId id of tx storing the sarcophagus payload on arweave
    function createSarcophagus(
        bytes32 sarcoId,
        SarcophagusParams calldata sarcophagusParams,
        CurseParams[] calldata selectedArchaeologists,
        string calldata arweaveTxId
    ) external {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Confirm that sarcophagus with supplied id doesn't already exist
        if (s.sarcophagi[sarcoId].resurrectionTime != 0) {
            revert SarcophagusAlreadyExists(sarcoId);
        }

        // Ensure too much time hasn't passed since the sarcophagus `creationTime` that has been signed
        // off by its cursed archaeologists.
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

        // Confirm that the resurrection time is less than the max resurrection time
        if (sarcophagusParams.resurrectionTime > sarcophagusParams.maximumResurrectionTime) {
            revert ResurrectionTimePastMaxResurrectionTime(
                sarcophagusParams.resurrectionTime,
                sarcophagusParams.maximumResurrectionTime
            );
        }

        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];

        // track total digging fees due upon creation of sarcophagus
        uint256 totalDiggingFees;

        {
            uint256 nSelectedArchs = selectedArchaeologists.length;
            // Validate archaeologist and threshold lengths
            if (nSelectedArchs == 0) {
                revert NoArchaeologistsProvided();
            }

            if (sarcophagusParams.threshold == 0) {
                revert ThresholdCannotBeZero();
            }

            // Ensure that k <= n in the effective k-of-n shamir secret sharing scheme
            // used to distribute keyshares among archaeologists
            if (sarcophagusParams.threshold > nSelectedArchs) {
                revert ThresholdGreaterThanTotalNumberOfArchaeologists(
                    sarcophagusParams.threshold,
                    nSelectedArchs
                );
            }

            // create the sarcophagus
            sarcophagus.name = sarcophagusParams.name;
            sarcophagus.threshold = sarcophagusParams.threshold;
            sarcophagus.resurrectionTime = sarcophagusParams.resurrectionTime;
            sarcophagus.previousRewrapTime = sarcophagusParams.creationTime;
            sarcophagus.maximumRewrapInterval = sarcophagusParams.maximumRewrapInterval;
            sarcophagus.maximumResurrectionTime = sarcophagusParams.maximumResurrectionTime;
            sarcophagus.arweaveTxId = arweaveTxId;
            sarcophagus.embalmerAddress = msg.sender;
            sarcophagus.recipientAddress = sarcophagusParams.recipientAddress;
            sarcophagus.cursedArchaeologistAddresses = new address[](nSelectedArchs);
            sarcophagus.cursedBondPercentage = s.cursedBondPercentage;

            for (uint256 i; i < nSelectedArchs; ) {
                LibUtils.revertIfArchProfileDoesNotExist(selectedArchaeologists[i].archAddress);

                // Confirm archaeologist isn't already cursed on this sarcophagus (no duplicates)
                if (
                    sarcophagus
                        .cursedArchaeologists[selectedArchaeologists[i].archAddress]
                        .publicKey
                        .length != 0
                ) {
                    revert ArchaeologistListContainsDuplicate(
                        selectedArchaeologists[i].archAddress
                    );
                }

                // Confirm archaeologist is not re-using a key pair
                if (
                    s.publicKeyToArchaeologistAddress[selectedArchaeologists[i].publicKey] !=
                    address(0)
                ) {
                    revert DuplicatePublicKey(selectedArchaeologists[i].publicKey);
                }

                LibUtils.verifyArchaeologistSignature(
                    sarcophagusParams.maximumRewrapInterval,
                    sarcophagusParams.maximumResurrectionTime,
                    sarcophagusParams.creationTime,
                    selectedArchaeologists[i]
                );

                // Curse the archaeologist on this sarcophagus
                uint256 diggingFeesDue = LibBonds.curseArchaeologist(
                    sarcoId,
                    selectedArchaeologists[i],
                    i
                );

                totalDiggingFees += diggingFeesDue;

                // "Consume" this public key so it cannot be reused in the future
                s.publicKeyToArchaeologistAddress[
                    selectedArchaeologists[i].publicKey
                ] = selectedArchaeologists[i].archAddress;
                unchecked {
                    ++i;
                }
            }

            // Transfer totalDiggingFees and the protocolFees in SARCO from embalmer to this contract
            uint256 protocolFees = LibUtils.calculateProtocolFees(totalDiggingFees);
            s.totalProtocolFees += protocolFees;
            s.sarcoToken.transferFrom(
                msg.sender,
                address(this),
                totalDiggingFees + protocolFees
            );
        }
        emit CreateSarcophagus(
            sarcoId,
            sarcophagusParams.name,
            sarcophagusParams.resurrectionTime,
            sarcophagusParams.creationTime,
            msg.sender,
            sarcophagusParams.recipientAddress,
            sarcophagus.cursedArchaeologistAddresses,
            totalDiggingFees,
            arweaveTxId
        );
    }

    /// @notice Updates the resurrectionTime on a sarcophagus. Callable by the embalmer of a sarcophagus if its
    /// resurrection time has not passed, it has not been compromised by k or more accusals, and it has not been buried.
    /// @param sarcoId the identifier of the sarcophagus
    /// @param resurrectionTime the new resurrection time
    function rewrapSarcophagus(bytes32 sarcoId, uint256 resurrectionTime) external {
        AppStorage storage s = LibAppStorage.getAppStorage();
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
        if (sarcophagus.resurrectionTime == type(uint256).max) {
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

        // Confirm that the new resurrection time doesn't exceed the maximumResurrectionTime
        if (sarcophagus.maximumResurrectionTime < resurrectionTime) {
            revert ResurrectionTimePastMaxResurrectionTime(
                resurrectionTime,
                sarcophagus.maximumResurrectionTime
            );
        }

        // track total digging fees to be paid by embalmer across all archaeologists on the sarcophagus
        uint256 totalDiggingFees;

        // pay digging fee to each cursed archaeologist on the sarcophagus that has not been accused
        address[] storage archaeologistAddresses = sarcophagus.cursedArchaeologistAddresses;
        uint256 cursedBondPercentage = sarcophagus.cursedBondPercentage;

        uint256 nArchAddresses = archaeologistAddresses.length;
        for (uint256 i; i < nArchAddresses; ) {
            LibTypes.CursedArchaeologist storage cursedArchaeologist = sarcophagus
                .cursedArchaeologists[archaeologistAddresses[i]];

            if (!cursedArchaeologist.isAccused) {
                // Previous digging fees calculation ignores curseFee
                // curseFee rewards and bond are handled separately if this sarcophagus has not been rewrapped yet
                uint256 prevDiggingFees = cursedArchaeologist.diggingFeePerSecond *
                    (sarcophagus.resurrectionTime - sarcophagus.previousRewrapTime);

                uint256 newDiggingFees = cursedArchaeologist.diggingFeePerSecond *
                    (resurrectionTime - block.timestamp);

                // If the new digging fees are greater than the previous digging fees, we need to
                // increase the archaeologist's cursed bond to cover the necessary cursed bond amount
                if (newDiggingFees > prevDiggingFees) {
                    uint256 cursedBondIncrease = ((newDiggingFees - prevDiggingFees) *
                        cursedBondPercentage) / 10000;

                    // If the previous cycle's rewards can't cover the cursed bond increase, revert
                    if (cursedBondIncrease > prevDiggingFees) {
                        revert ResurrectionTimeTooFarPastPreviousResurrectionTime(
                            resurrectionTime,
                            sarcophagus.resurrectionTime
                        );
                    }

                    // Increase the archaeologist's cursed bond using digging fees paid by the embalmer
                    s.archaeologistProfiles[archaeologistAddresses[i]]
                        .cursedBond += cursedBondIncrease;

                    // Rewards are now previous digging fees - difference
                    s.archaeologistRewards[archaeologistAddresses[i]] += (prevDiggingFees - cursedBondIncrease);
                } else if (newDiggingFees < prevDiggingFees) {
                    // New digging fees are less than the previous digging fees, so some of the cursed bond can be unlocked
                    uint256 cursedBondDecrease = ((prevDiggingFees - newDiggingFees) *
                        cursedBondPercentage) / 10000;

                    // Decrease archaeologist's cursed bond by the difference
                    s
                        .archaeologistProfiles[archaeologistAddresses[i]]
                        .cursedBond -= cursedBondDecrease;

                    // Increase archaeologist's free bond by the difference
                    s
                        .archaeologistProfiles[archaeologistAddresses[i]]
                        .freeBond += cursedBondDecrease;

                    // Rewards are equal to the previous digging fees
                    s.archaeologistRewards[archaeologistAddresses[i]] += prevDiggingFees;
                } else {
                    // Rewards are equal to the previous digging fees, the cursed bond can remain the same
                    s.archaeologistRewards[archaeologistAddresses[i]] += prevDiggingFees;
                }

                // Add digging fees due for the new interval
                totalDiggingFees += newDiggingFees;

                // If sarcophagus has not been rewrapped yet, pay out the curseFee and unlock the curseFee bond
                if (!sarcophagus.isRewrapped) {
                    // Pay archaeologists the curse fee to their rewards
                    s.archaeologistRewards[archaeologistAddresses[i]] += cursedArchaeologist.curseFee;

                    // Unlock the curseFee cursed bond by debiting the cursed bond and crediting free bond
                    LibBonds.decreaseCursedBond(
                        archaeologistAddresses[i],
                        ((cursedArchaeologist.curseFee * cursedBondPercentage) / 10000)
                    );

                    s.archaeologistProfiles[archaeologistAddresses[i]]
                        .freeBond += ((cursedArchaeologist.curseFee * cursedBondPercentage) / 10000);
                }
            }
            unchecked {
                ++i;
            }
        }

        uint256 protocolFees = LibUtils.calculateProtocolFees(totalDiggingFees);

        // Add the protocol fee to the total protocol fees in storage
        s.totalProtocolFees += protocolFees;

        // Update the sarcophagus resurrectionTime and previousRewrapTime
        sarcophagus.resurrectionTime = resurrectionTime;
        sarcophagus.previousRewrapTime = block.timestamp;

        if (!sarcophagus.isRewrapped) {
            sarcophagus.isRewrapped = true;
        }

        // Transfer the new digging fees and protocol fees from embalmer to contract
        s.sarcoToken.transferFrom(msg.sender, address(this), totalDiggingFees + protocolFees);

        emit RewrapSarcophagus(sarcoId, resurrectionTime, totalDiggingFees, protocolFees);
    }

    /// @notice Terminates a sarcophagus by setting its resurrection time to infinity and returning locked
    /// bonds to all innocent cursed archaeologists. Callable by the embalmer of a sarcophagus if its
    /// resurrection time has not passed, it has not been compromised by k or more accusals, and it has not been buried.
    /// @param sarcoId the identifier of the sarcophagus
    function burySarcophagus(bytes32 sarcoId) external {
        AppStorage storage s = LibAppStorage.getAppStorage();
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
        if (sarcophagus.resurrectionTime == type(uint256).max) {
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

        // for each archaeologist on the sarcophagus, unlock bond and pay digging fees
        address[] storage archaeologistAddresses = sarcophagus.cursedArchaeologistAddresses;
        uint256 nArchAddresses = archaeologistAddresses.length;
        for (uint256 i; i < nArchAddresses; ) {
            LibTypes.CursedArchaeologist storage cursedArchaeologist = sarcophagus
                .cursedArchaeologists[archaeologistAddresses[i]];

            // if the archaeologist hasn't been accused transfer them their digging fees and return their locked bond
            if (!cursedArchaeologist.isAccused) {
                LibBonds.freeArchaeologist(sarcoId, archaeologistAddresses[i]);
            }
            unchecked {
                ++i;
            }
        }

        // Set resurrection time to infinity
        sarcophagus.resurrectionTime = type(uint256).max;

        emit BurySarcophagus(sarcoId);
    }
}
