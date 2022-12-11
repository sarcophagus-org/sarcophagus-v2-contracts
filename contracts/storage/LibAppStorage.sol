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
    // window after end of gracePeriod + resurrectionTime where embalmer can claim remaining bonds from archaeologists that have failed to publish key shares
    uint256 embalmerClaimWindow;

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

    // public key => archaeologist address
    mapping(bytes => address) publicKeyArchaeologist;

    // sarcophagus id => sarcophagus object
    mapping(bytes32 => LibTypes.Sarcophagus) sarcophagi;

    // archaeologist addresses
    address[] archaeologistProfileAddresses;
    // archaeologist address => profile
    mapping(address => LibTypes.ArchaeologistProfile) archaeologistProfiles;


    // current balance of rewards available for the archaeologist to withdraw
    mapping(address => uint256) archaeologistRewards;


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
