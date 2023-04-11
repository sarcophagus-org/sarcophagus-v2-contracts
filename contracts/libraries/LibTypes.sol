// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

/**
 * @title Types shared across facets for the Sarcophagus diamond
 */
library LibTypes {
    struct Sarcophagus {
        // Also used for existence checks -- does not exist if 0
        uint256 resurrectionTime;
        uint256 previousRewrapTime;
        // todo: run gas cost evaluation on storing isCompromised vs looping through stored archaeologists and checking isAccused
        bool isCompromised;
        bool isCleaned;
        uint8 threshold;
        string name;
        uint256 maximumRewrapInterval;
        uint256 maximumResurrectionTime;
        string arweaveTxId;
        address embalmerAddress;
        address recipientAddress;
        address[] cursedArchaeologistAddresses;
        mapping(address => CursedArchaeologist) cursedArchaeologists;
        uint256 cursedBondPercentage;
    }

    struct CursedArchaeologist {
        uint256 diggingFeePerSecond;
        // Also used for publish checks -- has not published if 0
        bytes32 privateKey;
        // Also used for curse checks -- is not bonded if length is 0
        bytes publicKey;
        bool isAccused;
    }

    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct ArchaeologistProfile {
        // Also used for existence checks -- does not exist if 0
        uint256 maximumRewrapInterval;
        uint256 maximumResurrectionTime;
        string peerId;
        uint256 minimumDiggingFeePerSecond;
        uint256 freeBond;
        uint256 cursedBond;
    }
}
