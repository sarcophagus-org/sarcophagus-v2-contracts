// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

/**
 * @title A collection of Errors
 * @notice This library defines all of the Errors that the Sarcophagus system
 * uses.
 */
library LibErrors {
    error ArchaeologistListNotUnique(address[] archaeologists);

    error ArchaeologistNotOnSarcophagus(address archaeologist);

    error ArweaveArchaeologistNotInList();

    error ArweaveTxIdEmpty();

    error IncorrectNumberOfArchaeologistSignatures(uint256 signaturesLength);

    error MinShardsGreaterThanArchaeologists(uint8 minShards);

    error MinShardsZero();

    error NoArchaeologistsProvided();

    error NotEnoughCursedBond(uint256 cursedBond, uint256 amount);

    error NotEnoughFreeBond(uint256 freeBond, uint256 amount);

    error ResurrectionTimeInPast(uint256 resurrectionTime);

    error SarcophagusAlreadyExists(bytes32 identifier);

    error SarcophagusAlreadyFinalized(bytes32 identifier);

    error SarcophagusNotFinalized(bytes32 identifier);

    error SarcophagusDoesNotExist(bytes32 identifier);

    error SenderNotEmbalmer(address sender, address embalmer);

    error SignatureFromWrongAccount(
        address hopefulAddress,
        address actualAddress
    );

    error SignatureListNotUnique();

    error NotEnoughFreeBond(uint256 freeBond, uint256 amount);

    // Used when an attempt is made to clean a sarcophagus that has not exceeded its resurrection window
    error SarcophagusNotCleanable();
}
