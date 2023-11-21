// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libraries/LibTypes.sol";

/**
 * Global diamond storage struct to be shared across facets
 */
struct AppStorage {
    // SARCO token contract
    IERC20 sarcoToken;
    // The Admin address allowed to call Admin Facet functions
    address admin;
    // total protocol fees available to be withdrawn by the admin
    uint256 totalProtocolFees;
    /**
     * Protocol level admin configurations
     */
    // % of total digging fees for sarcophagus to charge embalmer on create and rewrap. Denominator is 10000
    uint256 protocolFeeBasePercentage;
    // % of digging fees archaeologists must have locked up per curse in cursed bond. Denominator is 10000
    uint256 cursedBondPercentage;
    // grace period an archaeologist is given to resurrect a sarcophagus after the resurrection time. Specified in seconds
    uint256 gracePeriod;
    // threshold after which archaeologist signatures on sarcophagus params expire and the sarcophagus must be renegotiated. Specified in seconds
    uint256 expirationThreshold;
    // window after end of gracePeriod + resurrectionTime where embalmer can claim remaining bonds from archaeologists that have failed to publish private keys. Specified in seconds
    uint256 embalmerClaimWindow;
    // registered archaeologist addresses
    address[] archaeologistProfileAddresses;
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
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("sarcophagus.storage.1");

    function getAppStorage() internal pure returns (AppStorage storage s) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            s.slot := position
        }
    }
}
