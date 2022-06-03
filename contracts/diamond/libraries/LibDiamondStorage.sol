// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import {LibDiamond} from "./LibDiamond.sol";
import "../../libraries/LibTypes.sol";

/// @title State storage for the diamond
/// @notice LibDiamondStrorage keeps track of the global app storage for the
/// diamond pattern state and the app state.
/// This library is very interconnected with the diamond pattern and the
/// sarcophagus app
library LibDiamondStorage {
    // Note: fields may also be added to DiamondInit.sol to be initialized
    struct DiamondStorage {
        // =====================================================================
        // Diamond Pattern State
        // =====================================================================
        // An array of function selectors
        bytes4[] selectors;
        // A mapping of the function selector to the face address and selector position
        mapping(bytes4 => LibDiamond.FacetAddressAndSelectorPosition) facetAddressAndSelectorPosition;
        mapping(bytes4 => bool) supportedInterfaces;
        address contractOwner;
        // =====================================================================
        // Sarcophagus State
        // =====================================================================
        uint256 testValueA;
        uint256 testValueB;
        // archaeologists
        address[] archaeologistAddresses;
        mapping(address => LibTypes.Archaeologist) archaeologists;
        // archaeologist stats
        mapping(address => bytes32[]) archaeologistSuccesses;
        mapping(address => bytes32[]) archaeologistCancels;
        mapping(address => bytes32[]) archaeologistAccusals;
        mapping(address => bytes32[]) archaeologistCleanups;
        // archaeologist key control
        mapping(bytes => bool) archaeologistUsedKeys;
        // sarcophaguses
        bytes32[] sarcophagusIdentifiers;
        mapping(bytes32 => LibTypes.Sarcophagus) sarcophaguses;
        // sarcophagus ownerships
        mapping(address => bytes32[]) embalmerSarcophaguses;
        mapping(address => bytes32[]) archaeologistSarcophaguses;
        mapping(address => bytes32[]) recipientSarcophaguses;
    }
}
