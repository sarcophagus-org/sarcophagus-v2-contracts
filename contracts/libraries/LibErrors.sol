// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

/**
 * @title A collection of Errors
 * @notice This library defines all of the Errors that the Sarcophagus system
 * uses.
 */
library LibErrors {
    error AccuseNotEnoughProof(uint256 shardsProvided, uint8 minShards);

    error AccuseIncorrectProof();

    error ArchaeologistAlreadyUnwrapped(address archaeologist);

    error ArchaeologistListNotUnique(address archaeologistAddress);

    error ArchaeologistNotOnSarcophagus(address archaeologist);

    error ArchaeologistProfileExistsShouldBe(bool exists, address archaeologist);

    error DiggingFeeTooLow(uint256 diggingFee, address archaeologist);

    error MinShardsGreaterThanArchaeologists(uint8 minShards);

    error MinShardsZero();

    error MaxResurrectionIntervalIsZero();

    error NewResurrectionTimeInPast(uint256 newResurrectionTime);

    error NewResurrectionTimeTooLarge(uint256 newResurrectionTime);

    error NoArchaeologistsProvided();

    error NotEnoughCursedBond(uint256 cursedBond, uint256 amount);

    error NotEnoughFreeBond(uint256 freeBond, uint256 amount);

    error NotEnoughReward(uint256 reward, uint256 amount);

    error ResurrectionTimeInPast(uint256 resurrectionTime);

    error ResurrectionTimeTooFarInFuture(
        uint256 resurrectionTime,
        uint256 sarcophagusMaximumRewrapInterval
    );

    error SarcophagusAlreadyExists(bytes32 sarcoId);

    error SarcophagusDoesNotExist(bytes32 sarcoId);

    error SarcophagusInactive(bytes32 sarcoId);

    error SarcophagusCompromised(bytes32 sarcoId);

    error SenderNotEmbalmer(address sender, address embalmer);

    error InvalidSignature(
        // address recovered from signature via ecrecover
        address recoveredAddress,
        // address we expected to have signed the data
        address expectedAddress
    );

    error SignerNotArchaeologistOnSarcophagus(bytes32 sarcoId, address signer);

    // Used when an attempt is made to accuse or rewrap after the resurrection time has already passed (so it's actually time to unwrap it)
    error SarcophagusIsUnwrappable();

    error TooEarlyToUnwrap(uint256 resurrectionTime, uint256 currentTime);

    error TooLateToUnwrap(uint256 resurrectionTime, uint256 gracePeriod, uint256 currentTime);

    error UnencryptedShardHashMismatch(bytes rawKeyShare, bytes32 doubleHashedKeyShare);

    error SarcophagusParametersExpired(uint256 timestamp);

    /// @notice An archaeologist that has already been accused has attempted to publish a key share
    /// @param archaeologistAddress Address of accused archaeologist
    /// @param sarcoId ID of sarcophagus archaeologist has attempted to publish a share on
    error ArchaeologistHasBeenAccused(address archaeologistAddress, bytes32 sarcoId);

    /// @notice Clean has been called on a sarcophagus that has already been cleaned
    /// @param sarcoId ID of sarcophagus archaeologist has attempted to publish a share on
    error SarcophagusAlreadyCleaned(bytes32 sarcoId);

    /// @notice Clean has been called before the deadline for archaeologists to publish key shares has passed
    /// @param currentTime Timestamp of the failed clean attempt
    /// @param publishDeadline Latest time an archaeologist may publish a key share on a sarcophagus: esurrectionTime + gracePeriod
    error TooEarlyForClean(uint256 currentTime, uint256 publishDeadline);

    /// @notice Clean has been called by someone other than the admin or embalmer of the sarcophagus
    /// @param senderAddress Address of sender
    error SenderNotEmbalmerOrAdmin(address senderAddress);

    /// @notice Embalmer has attempted to clean a sarcophagus after the embalmerClaimWindow has passed
    /// @param currentTime Timestamp of the failed clean attempt
    /// @param embalmerClaimWindowEnd Latest time an embalmer may claim residual locked bonds the sarcophagus: resurrectionTime + gracePeriod + embalmerClaimWindow
    error EmbalmerClaimWindowPassed(uint256 currentTime, uint256 embalmerClaimWindowEnd);

    /// @notice Admin has attempted to clean a sarcophagus before the embalmerClaimWindow has passed
    /// @param currentTime Timestamp of the failed clean attempt
    /// @param embalmerClaimWindowEnd Latest time an embalmer may claim residual locked bonds the sarcophagus: resurrectionTime + gracePeriod + embalmerClaimWindow
    error TooEarlyForAdminClean(uint256 currentTime, uint256 embalmerClaimWindowEnd);



}
