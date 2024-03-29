// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

/**
 * @title A collection of Errors
 * @notice This library defines all of the Errors that the Sarcophagus system
 * uses.
 */
library LibErrors {
    error ArchaeologistNotOnSarcophagus(address archaeologist);

    error NotEnoughCursedBond(uint256 cursedBond, uint256 amount);

    error NotEnoughFreeBond(uint256 freeBond, uint256 amount);

    error ArchaeologistProfileExistsShouldBe(bool exists, address archaeologist);

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
}
