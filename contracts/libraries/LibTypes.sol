// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

/**
 * @title A collection of defined structs
 * @notice This library defines the various data models that the Sarcophagus
 * system uses
 */
library LibTypes {

    struct CursedArchaeologist {
        bool isAccused;
        uint256 diggingFee;
        bytes32 doubleHashedKeyshare; // might be able to remove this and just use the mapping hash => arch
        bytes rawKeyshare;
    }


    // DoesNotExist must come first on the list to be the default value
    enum SarcophagusState {
        DoesNotExist,
        Active,
        Resurrecting,
        Resurrected,
        Buried,
        Cleaned,
        Accused,
        Failed
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
        bool isAccused;
        uint256 diggingFee;
        uint256 diggingFeesPaid; // no longer needed
        bytes32 unencryptedShardDoubleHash; // might be able to remove this and just use the mapping hash => arch
        bytes unencryptedShard;
    }


    // ArchaeologistProfile is used to store archaeologist profile data
    struct ArchaeologistProfile {
        bool exists;
        string peerId;
        uint256 minimumDiggingFee;
        uint256 maximumRewrapInterval;
        uint256 freeBond;
        uint256 cursedBond;
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
        uint8 minShards;
        uint256 resurrectionTime;
        uint256 maximumRewrapInterval;
        string[] arweaveTxIds;
        address embalmer;
        address recipientAddress;
        address[] archaeologists;
    }

    // Only used in the ViewStateFacet to return statistics data.
    // Contains a list of sarcoIds for each category. We could simply return the counts of the
    // arrays but we are already storing the lists of sarcoIds so we may as well use them.
    struct ArchaeologistStatistics {
        uint256 successes;
        uint256 accusals;
        uint256 cleanups;
    }
}
