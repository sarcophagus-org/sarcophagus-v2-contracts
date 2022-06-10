// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "../libraries/LibTypes.sol";

// Global storage for the app. Can be accessed in facets and in libraries
struct AppStorage {
    // archaeologists
    mapping(address => uint256) freeBonds;
    mapping(address => uint256) cursedBonds;
    // archaeologist stats
    mapping(address => bytes32[]) archaeologistSuccesses;
    mapping(address => bytes32[]) archaeologistCancels;
    mapping(address => bytes32[]) archaeologistAccusals;
    mapping(address => bytes32[]) archaeologistCleanups;
    // sarcophaguses
    bytes32[] sarcophagusIdentifiers;
    mapping(bytes32 => LibTypes.Sarcophagus) sarcophaguses;
    // sarcophagus ownerships
    mapping(address => bytes32[]) embalmerSarcophaguses;
    mapping(address => bytes32[]) archaeologistSarcophaguses;
    mapping(address => bytes32[]) recipientSarcophaguses;
    // A mapping used to store an archaeologist's data on a sarcophagus.
    // Bounty, digging fees, storage fees, and the hashed shards of the
    // archaeologists all need to be stored per sarcophagus. This mapping of a
    // mapping stores the archaeologist's data we need per sarcophagus.
    // Example usage:
    //     uint256 bounty = sarcophagusArchaeologists[identifier][archAddress];
    mapping(bytes32 => mapping(address => LibTypes.Archaeologist)) sarcophagusArchaeologists;
}

library LibAppStorage {
    function getAppStorage() internal pure returns (AppStorage storage s) {
        // Set the position of our struct in contract storage
        // Since AppStorage s is the first and only state variable declared in
        // facets its position in contract storage is 0
        assembly {
            s.slot := 0
        }
    }
}
