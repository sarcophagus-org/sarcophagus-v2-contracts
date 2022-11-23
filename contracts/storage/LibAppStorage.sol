// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";

/**
* Global diamond storage struct to be shared across facets
* TODO: Implement diamond storage pattern and consider splitting storage into facet specific structs
*/
struct AppStorage {
    // SARCO token contract
    IERC20 sarcoToken;

    // total protocol fees available to be withdrawn by the admin
    uint256 totalProtocolFees;

    /**
    * Protocol level admin configurations
    */
    // % of total digging fees for sarcophagus to charge embalmer on create and rewrap
    uint256 protocolFeeBasePercentage;
    // grace period an archaeologist is given to resurrect a sarcophagus after the resurrection time
    uint256 gracePeriod;
    // threshold after which archaeologist signatures on sarcophagus params expire and the sarcophagus must be renegotiated
    uint256 expirationThreshold;

    /**
    * Ownership mappings
    */
    // embalmer address => ids of sarcophagi they've created
    mapping(address => bytes32[]) embalmerSarcophagi;
    // archaeologist address =>  ids of sarcophagi they're protecting
    mapping(address => bytes32[]) archaeologistSarcophagi;
    // recipient address =>  ids of sarcophagi they're recipient on
    mapping(address => bytes32[]) recipientSarcophagi;

    // double hashed keyshare => archaeologist address
    mapping(bytes32 => address) doubleHashedShardArchaeologists;

    // sarcophagus id => mapping of archaeologist address => archaeologist info
    mapping(bytes32 => mapping(address => LibTypes.ArchaeologistStorage)) sarcophagusArchaeologists;

    // sarcophagus ids
    bytes32[] sarcophagusIdentifiers;
    // sarcophagus id => sarcophagus object
    mapping(bytes32 => LibTypes.Sarcophagus) sarcophagi;

    // archaeologist addresses
    address[] archaeologistProfileAddresses;
    // archaeologist address => profile
    mapping(address => LibTypes.ArchaeologistProfile) archaeologistProfiles;


    // current balance of rewards available for the archaeologist to withdraw
    // todo: Combine with ArchaeologistProfile.freeBond
    mapping(address => uint256) archaeologistRewards;

    // todo: Remove and check for successful resurrection at sarcophagus.archaeologistInfo[addr].keyshare
    // mapping of archaeologist address => sarco id => whether or not the archaeologist unwrapped that sarcophagus
    mapping(address => mapping(bytes32 => bool)) archaeologistSarcoSuccesses;

    /**
    * Archaeologist reputation statistics
    * todo: could these be organized differently?
    */
    mapping(address => bytes32[]) archaeologistSuccesses;
    mapping(address => bytes32[]) archaeologistAccusals;
    mapping(address => bytes32[]) archaeologistCleanups;
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
