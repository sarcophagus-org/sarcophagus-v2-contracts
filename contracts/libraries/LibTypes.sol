// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

/**
 * @title A collection of defined structs
 * @notice This library defines the various data models that the Heritage
 * system uses
 */
library LibTypes {
    // DoesNotExist must come first on the list to be the default value
    enum VaultState {
        DoesNotExist,
        Exists,
        Done
    }

    // A struct of just the signature. This is used primarily by the
    // finalizeVault function for the arweave signatory. Note that,
    // unlike the regular signatories, the vault already stores the
    // single arweave signatory's address so there is no need to pass in the
    // address to the finalizeVault function.
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // Signature struct created to make passing in the signature argmuments into
    // finalizedVault easier and to avoid the "stack too deep" error.
    // Also attaching arachaeologist addresses so we can tie the signature back
    // to the address in finalizeVault.
    struct SignatureWithAccount {
        address account;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // SelectedSignatoryData is the struct that is passed into the
    // initializeVault function. Even though we don't need each storage
    // fee of the signatory, the storage fee is included in the struct to
    // reduce the stack size within the function, preventing the "stack too
    // deep" error.
    struct SelectedSignatoryData {
        address signatoryAddress;
        uint256 diggingFee;
        bytes32 unencryptedShardDoubleHash;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // SignatoryStorage is the struct that is stored in AppStorage under the
    // vaultSignatories mapping.
    //
    // The signatory address is left out since each signatory's address
    // is stored on the vault object as an array.
    //
    // The storage fee is left out because we only need to store the storage fee
    // of the signatory uploading to arweave, which will be stored directly
    // on the vault.
    struct SignatoryStorage {
        uint256 diggingFee;
        uint256 diggingFeesPaid;
        bytes32 unencryptedShardDoubleHash;
        bytes unencryptedShard;
    }

    // SignatoryProfile is used to store signatory profile data
    struct SignatoryProfile {
        bool exists;
        string peerId;
        uint256 minimumDiggingFee;
        uint256 maximumRewrapInterval;
        uint256 freeBond;
        uint256 cursedBond;
    }

    struct VaultMemory {
        string name;
        address recipient;
        uint256 resurrectionTime;
        uint256 maximumRewrapInterval;
        bool canBeTransferred;
        uint8 minShards;
        uint256 timestamp;
    }

    // The SignatoryStorage struct could be contained in this Vault
    // struct as a mapping, but it was put into it's own mapping
    // (vaultSignatories) directly in AppStorage. Instead the
    // vault stores the addresses of each signatory added to it. This
    // was done to simplify the creation of a vault object in
    // initializeVault.
    struct Vault {
        string name;
        VaultState state;
        bool canBeTransferred;
        uint8 minShards;
        uint256 resurrectionTime;
        uint256 maximumRewrapInterval;
        string[] arweaveTxIds;
        address vaultOwner;
        address recipientAddress;
        address[] signatories;
    }

    struct MetadataAttributes {
        string vaultName;
        uint256 diggingFee;
        uint256 resurrectionTime;
        uint256 diggingFeesPaid;
    }

    // Only used in the ViewStateFacet to return statistics data.
    // Contains a list of vaultIds for each category. We could simply return the counts of the
    // arrays but we are already storing the lists of vaultIds so we may as well use them.
    struct SignatoryStatistics {
        uint256 successes;
        uint256 accusals;
        uint256 cleanups;
    }
}
