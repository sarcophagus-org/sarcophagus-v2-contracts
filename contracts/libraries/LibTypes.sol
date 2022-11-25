// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

/**
 * @title Types shared across facets for the Sarcophagus diamond
 */
library LibTypes {
    struct Sarcophagus {
        // never zero - use for existence checks
        uint256 resurrectionTime;
        // todo: run gas cost evaluation on storing isCompromised vs looping through stored archaeologists and checking isAccused
        bool isCompromised;
        string name;
        uint8 threshold;
        uint256 maximumRewrapInterval;
        string[2] arweaveTxIds;
        address embalmerAddress;
        address recipientAddress;
        address[] archaeologistAddresses;
        mapping(address => CursedArchaeologist) cursedArchaeologists;
    }

    struct CursedArchaeologist {
        // never empty - use for existence checks
        bytes32 doubleHashedKeyShare; // todo: we shouldn't need this and the doublehash->arch mapping
        bool isAccused;
        uint256 diggingFee;
        bytes rawKeyShare;
    }

    struct ArchaeologistProfile {
        bool exists; // todo: use peerid.length instead of exists
        string peerId;
        uint256 minimumDiggingFee;
        uint256 maximumRewrapInterval;
        uint256 freeBond;
        uint256 cursedBond;
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
