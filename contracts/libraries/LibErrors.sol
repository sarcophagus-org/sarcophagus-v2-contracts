// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

/**
 * @title A collection of Errors
 * @notice This library defines all of the Errors that the Heritage system
 * uses.
 */
library LibErrors {
    error AccuseNotEnoughProof(uint256 shardsProvided, uint8 minShards);

    error AccuseIncorrectProof();

    error SignatoryAlreadyUnwrapped(address signatory);

    error SignatoryListNotUnique(address[] signatories);

    error SignatoryNotOnVault(address signatory);

    error SignatoryProfileExistsShouldBe(bool exists, address signatory);

    error ArweaveTxIdsInvalid();

    error DiggingFeeTooLow(uint256 diggingFee, address signatory);

    error MinShardsGreaterThanSignatories(uint8 minShards);

    error MinShardsZero();

    error MaxResurrectionIntervalIsZero();

    error NewResurrectionTimeInPast(uint256 newResurrectionTime);

    error NewResurrectionTimeTooLarge(uint256 newResurrectionTime);

    error NoSignatoriesProvided();

    error NotEnoughCursedBond(uint256 cursedBond, uint256 amount);

    error NotEnoughFreeBond(uint256 freeBond, uint256 amount);

    error NotEnoughReward(uint256 reward, uint256 amount);

    error ResurrectionTimeInPast(uint256 resurrectionTime);

    error ResurrectionTimeTooFarInFuture(uint256 resurrectionTime, uint256 vaultMaximumRewrapInterval);

    error VaultAlreadyExists(bytes32 vaultId);

    error VaultDoesNotExist(bytes32 vaultId);

    error SenderNotEmbalmer(address sender, address testator);

    error InvalidSignature(
    // address recovered from signature via ecrecover
        address recoveredAddress,
    // address we expected to have signed the data
        address expectedAddress
    );

    error SignerNotSignatoryOnVault(bytes32 vaultId, address signer);

    // Used when an attempt is made to accuse or rewrap after the resurrection time has already passed (so it's actually time to unwrap it)
    error VaultIsUnwrappable();

    // Used when an attempt is made to clean a vault before the grace period after the resurrection time has passed
    error VaultNotCleanable();

    error TooEarlyToUnwrap(uint256 resurrectionTime, uint256 currentTime);

    error TooLateToUnwrap(
        uint256 resurrectionTime,
        uint256 gracePeriod,
        uint256 currentTime
    );

    error UnencryptedShardHashMismatch(
        bytes unencryptedShard,
        bytes32 doubleHashedShard
    );

    error VaultParametersExpired(uint256 timestamp);
}

