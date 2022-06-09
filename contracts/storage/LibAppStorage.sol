// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "../libraries/LibTypes.sol";

// Global storage for the app. Can be accessed in facets and in libraries
struct AppStorage {
    // archaeologists
    address[] archaeologistAddresses;
    mapping(address => LibTypes.Archaeologist) archaeologists;
    // archaeologist stats
    mapping(address => bytes32[]) archaeologistSuccesses;
    mapping(address => bytes32[]) archaeologistCancels;
    mapping(address => bytes32[]) archaeologistAccusals;
    mapping(address => bytes32[]) archaeologistCleanups;
    // archaeologist key control
    mapping(bytes => bool) archaeologistUsedKeys;
    // sarcophaguses
    bytes32[] sarcophagusIdentifiers;
    mapping(bytes32 => LibTypes.Sarcophagus) sarcophaguses;
    // sarcophagus ownerships
    mapping(address => bytes32[]) embalmerSarcophaguses;
    mapping(address => bytes32[]) archaeologistSarcophaguses;
    mapping(address => bytes32[]) recipientSarcophaguses;
    uint256 testValueA;
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
