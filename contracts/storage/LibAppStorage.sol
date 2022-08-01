// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ICurses.sol";
import "../libraries/LibTypes.sol";

// Global storage for the app. Can be accessed in facets and in libraries
struct AppStorage {
    IERC20 sarcoToken;
    ICurses curses;
    // The amount to be taken from the embalmer each time a protocol fee should
    // be collected
    uint256 protocolFee;
    // The amount of protocol fees currently stored on the contract
    uint256 totalProtocolFees;
    // sarcophagi
    bytes32[] sarcophagusIdentifiers;
    // Each archaeologist's total free and cursed bonds
    mapping(address => uint256) freeBonds;
    mapping(address => uint256) cursedBonds;
    // archaeologist stats
    mapping(address => mapping(bytes32 => bool)) archaeologistSuccesses;
    mapping(address => bytes32[]) archaeologistCancels;
    mapping(address => bytes32[]) archaeologistAccusals;
    mapping(address => bytes32[]) archaeologistCleanups;
    // Track how much archaeologists have made. To be credited and debited
    // as archaeologists fulfil their duties and withdraw their rewards
    mapping(address => uint256) archaeologistRewards;
    mapping(bytes32 => LibTypes.Sarcophagus) sarcophagi;
    // sarcophagus ownerships
    mapping(address => bytes32[]) embalmerSarcophagi;
    mapping(address => bytes32[]) archaeologistSarcophagi;
    mapping(address => bytes32[]) recipientSarcophagi;
    // Mapping of unencrypted shard double hashes to archaeologists who are
    // responsible for them. Needed to optimise Accuse algo - unencrypted shard is
    // double hashed and used as a constant O(1) lookup here
    mapping(bytes32 => address) doubleHashedShardArchaeologists;
    // A mapping used to store an archaeologist's data on a sarcophagus.
    // Bounty, digging fees, storage fees, and the hashed shards of the
    // archaeologists all need to be stored per sarcophagus. This mapping of a
    // mapping stores the archaeologist's data we need per sarcophagus.
    // Example usage (to retrieve the bounty an archaeologist may claim on some sarcophagus):
    //   LibTypes.ArchaeologistStorage bondedArchaeologist = sarcophagusArchaeologists[sarcoId][archAddress];
    //   uint256 bounty = bondedArchaeologist.bounty;
    mapping(bytes32 => mapping(address => LibTypes.ArchaeologistStorage)) sarcophagusArchaeologists;
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
