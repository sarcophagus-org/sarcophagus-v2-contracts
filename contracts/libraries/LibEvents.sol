// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

/**
 * @title A collection of Events
 * @notice This library defines all of the Events that the Sarcophagus system
 * emits
 */
library LibEvents {
    event Creation(address sarcophagusContract);

    event RegisterArchaeologist(
        address indexed archaeologist,
        bytes currentPublicKey,
        string endpoint,
        address paymentAddress,
        uint256 feePerByte,
        uint256 minimumBounty,
        uint256 minimumDiggingFee,
        uint256 maximumResurrectionTime,
        uint256 bond
    );

    event UpdateArchaeologist(
        address indexed archaeologist,
        string endpoint,
        address paymentAddress,
        uint256 feePerByte,
        uint256 minimumBounty,
        uint256 minimumDiggingFee,
        uint256 maximumResurrectionTime,
        uint256 addedBond
    );

    event UpdateArchaeologistPublicKey(
        address indexed archaeologist,
        bytes currentPublicKey
    );

    event WithdrawFreeBond(
        address indexed archaeologist,
        uint256 withdrawnBond
    );

    event DepositFreeBond(address indexed archaeologist, uint256 depositedBond);

    event InitializeSarcophagus(
        bytes32 indexed identifier,
        string name,
        bool canBeTransferred,
        uint256 resurrectionTime,
        address embalmer,
        address recipientAddress,
        address arweaveArchaeologist,
        address[] archaeologists
    );

    event FinalizeSarcophagus(bytes32 indexed identifier, string arweaveTxId);

    event CancelSarcophagus(bytes32 indexed identifier);

    event RewrapSarcophagus(
        string assetId,
        bytes32 indexed identifier,
        uint256 resurrectionTime,
        uint256 resurrectionWindow,
        uint256 diggingFee,
        uint256 bounty,
        uint256 cursedBond
    );

    event UnwrapSarcophagus(
        string assetId,
        bytes32 indexed identifier,
        bytes32 privatekey
    );

    event AccuseArchaeologist(
        bytes32 indexed identifier,
        address indexed accuser,
        uint256 accuserBondReward,
        uint256 embalmerBondReward
    );

    event BurySarcophagus(bytes32 indexed identifier);

    event CleanUpSarcophagus(
        bytes32 indexed identifier,
        address indexed cleaner,
        uint256 cleanerBondReward,
        uint256 embalmerBondReward
    );
}
