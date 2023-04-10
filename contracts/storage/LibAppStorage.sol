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
    // % of digging fees archaeologists must have locked up per curse in cursed bond
    uint256 cursedBondPercentage;
    // grace period an archaeologist is given to resurrect a sarcophagus after the resurrection time
    uint256 gracePeriod;
    // threshold after which archaeologist signatures on sarcophagus params expire and the sarcophagus must be renegotiated
    uint256 expirationThreshold;
    // window after end of gracePeriod + resurrectionTime where embalmer can claim remaining bonds from archaeologists that have failed to publish private keys
    uint256 embalmerClaimWindow;
    // registered archaeologist addresses
    address[] archaeologistProfileAddresses;
    /**
     * Ownership mappings
     */
    // embalmer address => ids of sarcophagi they've created
    mapping(address => bytes32[]) embalmerSarcophagi;
    // archaeologist address =>  ids of sarcophagi they're protecting
    mapping(address => bytes32[]) archaeologistSarcophagi;
    // recipient address =>  ids of sarcophagi they're recipient on
    mapping(address => bytes32[]) recipientSarcophagi;
    // public key => archaeologist address
    mapping(bytes => address) publicKeyToArchaeologistAddress;
    // sarcophagus id => sarcophagus object
    mapping(bytes32 => LibTypes.Sarcophagus) sarcophagi;
    // archaeologist address => profile
    mapping(address => LibTypes.ArchaeologistProfile) archaeologistProfiles;
    // current balance of rewards available for the archaeologist to withdraw
    mapping(address => uint256) archaeologistRewards;
}

library LibAppStorage {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("sarcophagus.storage.dev2");

    function getAppStorage() internal pure returns (AppStorage storage s) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            s.slot := position
        }
    }
}
