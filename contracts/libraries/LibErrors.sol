// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

/**
 * @title A collection of Errors
 * @notice This library defines all of the Errors that the Sarcophagus system
 * uses.
 */
library LibErrors {
    error ArweaveTxIdEmpty();

    error IncorrectNumberOfArchaeologistSignatures(uint256 signaturesLength);

    error NoArchaeologistsProvided();

    error NotEnoughCursedBond(uint256 cursedBond, uint256 amount);

    error NotEnoughFreeBond(uint256 freeBond, uint256 amount);

    error ResurrectionTimeInPast(uint256 resurrectionTime);

    error SarcophagusAlreadyExists(bytes32 identifier);

    error SarcophagusAlreadyFinalized(bytes32 identifier);

    error SarcophagusDoesNotExist(bytes32 identifier);

    error SenderNotArch(address sender, address arch);

    error SenderNotEmbalmer(address sender, address embalmer);

    error SignatureFromWrongAccount(
        address hopefulAddress,
        address actualAddress
    );

    error ArchaeologistNotOnSarcophagus(address archaeologist);

    error MinShardsGreaterThanArchaeologists(uint8 minShards);

    error MinShardsZero();
}
