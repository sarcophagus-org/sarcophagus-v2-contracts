// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ICurses.sol";
import "../libraries/LibTypes.sol";

// Global storage for the app. Can be accessed in facets and in libraries
struct AppStorage {
    IERC20 sarcoToken;
    ICurses curses;
    // The percentage (i.e. 1 = 1%) of a sarcophagus' total digging fees that will be collected on
    // createSarcophagus and rewrapSarcophagus, paid by the embalmer
    uint256 protocolFeeBasePercentage;
    // The amount of protocol fees currently stored on the contract
    uint256 totalProtocolFees;
    // grace period an archaeologist is given to resurrect a sarcophagus after the resurrection time
    uint256 gracePeriod;
    // threshold after which archaeologist signatures on sarcophagus params expire and the sarcophagus must be renegotiated
    uint256 expirationThreshold;
    // sarcophagi
    bytes32[] sarcophagusIdentifiers;
    // archaeologist profiles
    address[] archaeologistProfileAddresses;
    mapping(address => LibTypes.ArchaeologistProfile) archaeologistProfiles;

    // archaeologistSarcoSuccesses is needed by the clean function
    // to lookup whether an archaeologist has completed an unwrapping
    mapping(address => mapping(bytes32 => bool)) archaeologistSarcoSuccesses;

    // Archaeologist reputation statistics
    mapping(address => bytes32[]) archaeologistSuccesses;
    mapping(address => bytes32[]) archaeologistAccusals;
    mapping(address => bytes32[]) archaeologistCleanups;

    // Track how much archaeologists have made. To be credited and debited
    // as archaeologists fulfill their duties and withdraw their rewards
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
    // Digging fees, storage fees, and the hashed shards of the
    // archaeologists all need to be stored per sarcophagus. This mapping of a
    // mapping stores the archaeologist's data we need per sarcophagus.
    // Example usage (to retrieve the digging fees an archaeologist may claim on some sarcophagus):
    //   LibTypes.ArchaeologistStorage bondedArchaeologist = sarcophagusArchaeologists[sarcoId][archAddress];
    //   uint256 diggingFees = bondedArchaeologist.diggingFees;
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
