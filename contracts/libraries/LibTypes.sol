// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

/**
 * @title A collection of defined structs
 * @notice This library defines the various data models that the Sarcophagus
 * system uses
 */
library LibTypes {
    // DoesNotExist must come first on the list to be the default value
    enum SarcophagusState {
        DoesNotExist,
        Exists,
        Done
    }

    // A struct of just the signature. This is used primarily by the
    // finalizeSarcophagus function for the arweave archaeologist. Note that,
    // unlike the regular archaeologists, the sarcophagus already stores the
    // single arweave archaeologist's address so there is no need to pass in the
    // address to the finalizeSarcophagus function.
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // Signature struct created to make passing in the signature argmuments into
    // finalizedSarcophagus easier and to avoid the "stack too deep" error.
    // Also attaching arachaeologist addresses so we can tie the signature back
    // to the address in finalizeSarcophagus.
    struct SignatureWithAccount {
        address account;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // SelectedArchaeologistMemory is the struct that is passed into the
    // initializeSarcophagus function. Even though we don't need each storage
    // fee of the archaeologist, the storage fee is included in the struct to
    // reduce the stack size within the function, preventing the "stack too
    // deep" error.
    struct SelectedArchaeologistMemory {
        address archAddress;
        uint256 storageFee;
        uint256 diggingFee;
        uint256 bounty;
        bytes32 hashedShard;
    }

    // ArchaeologistStorage is the struct that is stored in AppStorage under the
    // sarcophagusArchaeologists mapping.
    //
    // The archaeologist address is left out since each archaeologist's address
    // is stored on the sarcophagus object as an array.
    //
    // The storage fee is left out because we only need to store the storage fee
    // of the archaeologist uploading to arweave, which will be stored directly
    // on the sarcophagus.
    struct ArchaeologistStorage {
        uint256 diggingFee;
        uint256 bounty;
        uint256 diggingFeesPaid;
        bytes32 doubleHashedShard;
        bytes unencryptedShard;
        uint256 curseTokenId;
    }

    // ArchaeologistProfile is used to store archaeologist profile data
    struct ArchaeologistProfile {
        bool exists;
        uint256 minimumDiggingFee;
        uint256 maximumResurrectionInterval;
        uint256 freeBond;
        uint256 cursedBond;
        uint256 rewards;
    }

    struct SarcophagusMemory {
        string name;
        address recipient;
        uint256 resurrectionTime;
        bool canBeTransferred;
        uint8 minShards;
    }

    // The ArchaeologistStorage struct could be contained in this Sarcophagus
    // struct as a mapping, but it was put into it's own mapping
    // (sarcophagusArchaeologists) directly in AppStorage. Instead the
    // sarcophagus stores the addresses of each archaeologist added to it. This
    // was done to simplify the creation of a sarcophagus object in
    // initializeSarcophagus.
    struct Sarcophagus {
        string name;
        SarcophagusState state;
        bool canBeTransferred;
        uint8 minShards;
        uint256 resurrectionTime;
        uint256 resurrectionWindow;
        string[] arweaveTxIds;
        uint256 storageFee;
        address embalmer;
        address recipientAddress;
        address arweaveArchaeologist;
        address[] archaeologists;
    }

    struct MetadataAttributes {
        string sarcophagusName;
        uint256 diggingFee;
        uint256 bounty;
        uint256 resurrectionTime;
        uint256 diggingFeesPaid;
    }
}
