// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

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

    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // ArchaeologistMemory is the struct that is passed into the
    // initializeSarcophagus function. Even though we don't need each storage
    // fee of the archaeologist, the storage fee is included in the struct to
    // reduce the stack size within the function, preventing the "stack too
    // deep" error.
    struct ArchaeologistMemory {
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
    // The storage fee is left out becuase we only need to store the storage fee
    // of the archaeologist uploading to arweave, which will be stored directly
    // on the sarcophagus.
    struct ArchaeologistStorage {
        uint256 diggingFee;
        uint256 bounty;
        bytes32 hashedShard;
    }
    struct Sarcophagus {
        string name;
        SarcophagusState state;
        bool canBeTransferred;
        uint256 resurrectionTime;
        string arweaveTxId;
        uint256 storageFee;
        address embalmer;
        address recipientAddress;
        address arweaveArchaeologist;
        address[] archaeologists;
    }
}
