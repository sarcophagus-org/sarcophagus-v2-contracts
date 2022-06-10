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

    struct Archaeologist {
        address archAddress;
        uint256 storageFee;
        uint256 diggingFee;
        uint256 bounty;
        bytes32 hashedShard;
    }

    // The sarcophagus stores the addresses of each archaeologist added to it.
    // The sarcophagusArchaeologists mapping in AppStorage is used to store the
    // archaeologist's data per sarcophagus.
    struct Sarcophagus {
        string name;
        SarcophagusState state;
        bool canBeTransferred;
        uint256 resurrectionTime;
        string arweaveTxId;
        address embalmer;
        address recipientAddress;
        address arweaveArchaeologist;
        address[] archaeologists;
    }
}
