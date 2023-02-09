// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

/**
 * @title Types shared across facets for the Sarcophagus diamond
 */
library LibTypes {
    struct Sarcophagus {
        // never zero - use for existence checks
        uint256 resurrectionTime;
        uint256 previousRewrapTime;
        // todo: run gas cost evaluation on storing isCompromised vs looping through stored archaeologists and checking isAccused
        bool isCompromised;
        bool isCleaned;
        string name;
        uint8 threshold;
        uint256 maximumRewrapInterval;
        uint256 maximumResurrectionTime;
        string arweaveTxId;
        address embalmerAddress;
        address recipientAddress;
        address[] cursedArchaeologistAddresses;
        mapping(address => CursedArchaeologist) cursedArchaeologists;
    }

    struct CursedArchaeologist {
        // never empty - use for existence checks
        bytes publicKey;
        bytes32 privateKey;
        bool isAccused;
        uint256 diggingFeePerSecond;
    }

    struct ArchaeologistProfile {
        bool exists; // todo: use peerid.length instead of exists
        string peerId;
        uint256 minimumDiggingFeePerSecond;
        uint256 maximumRewrapInterval;
        uint256 freeBond;
        uint256 cursedBond;
    }

    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }
}
