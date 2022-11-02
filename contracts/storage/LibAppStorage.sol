// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";

// Global storage for the app. Can be accessed in facets and in libraries
struct AppStorage {
    IERC20 heritageToken;
    // The percentage (i.e. 1 = 1%) of a vault' total digging fees that will be collected on
    // createVault and rewrapVault, paid by the vaultOwner
    uint256 protocolFeeBasePercentage;
    // The amount of protocol fees currently stored on the contract
    uint256 totalProtocolFees;
    // grace period an signatory is given to resurrect a vault after the resurrection time
    uint256 gracePeriod;
    // threshold after which signatory signatures on vault params expire and the vault must be renegotiated
    uint256 expirationThreshold;
    // vaults
    bytes32[] vaultIdentifiers;
    // signatory profiles
    address[] signatoryProfileAddresses;
    mapping(address => LibTypes.SignatoryProfile) signatoryProfiles;

    // signatoryVaultSuccesses is needed by the clean function
    // to lookup whether an signatory has completed an unwrapping
    mapping(address => mapping(bytes32 => bool)) signatoryVaultSuccesses;

    // Signatory reputation statistics
    mapping(address => bytes32[]) signatorySuccesses;
    mapping(address => bytes32[]) signatoryAccusals;
    mapping(address => bytes32[]) signatoryCleanups;

    // Track how much signatories have made. To be credited and debited
    // as signatories fulfill their duties and withdraw their rewards
    mapping(address => uint256) signatoryRewards;
    mapping(bytes32 => LibTypes.Vault) vaults;
    // vault ownerships
    mapping(address => bytes32[]) vaultOwnerVaults;
    mapping(address => bytes32[]) signatoryVaults;
    mapping(address => bytes32[]) recipientVaults;
    // Mapping of unencrypted shard double hashes to signatories who are
    // responsible for them. Needed to optimise Accuse algo - unencrypted shard is
    // double hashed and used as a constant O(1) lookup here
    mapping(bytes32 => address) doubleHashedShardSignatories;
    // A mapping used to store an signatory's data on a vault.
    // Digging fees, storage fees, and the hashed shards of the
    // signatories all need to be stored per vault. This mapping of a
    // mapping stores the signatory's data we need per vault.
    // Example usage (to retrieve the digging fees an signatory may claim on some vault):
    //   LibTypes.SignatoryStorage bondedSignatory = vaultSignatories[vaultId][archAddress];
    //   uint256 diggingFees = bondedSignatory.diggingFees;
    mapping(bytes32 => mapping(address => LibTypes.SignatoryStorage)) vaultSignatories;
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
