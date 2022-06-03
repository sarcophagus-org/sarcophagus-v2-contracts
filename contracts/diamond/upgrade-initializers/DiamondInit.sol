// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibDiamondStorage} from "../libraries/LibDiamondStorage.sol";
import {IDiamondLoupe} from "../interfaces/IDiamondLoupe.sol";
import {IDiamondCut} from "../interfaces/IDiamondCut.sol";
import {IERC173} from "../interfaces/IERC173.sol";
import {IERC165} from "../interfaces/IERC165.sol";

// Implementation of a diamond
// EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535

contract DiamondInit {
    /// @notice Initializes a diamond with default state values
    /// @dev You can add parameters to this function in order to pass in data to
    /// set your own state variables
    function init() external {
        LibDiamondStorage.DiamondStorage storage ds = LibDiamond
            .diamondStorage();
        // =====================================================================
        // Diamond Pattern State
        // =====================================================================
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;
        // =====================================================================
        // Sarcophagus State
        // =====================================================================
        ds.testValueA = 100;
        ds.testValueB = 200;
    }
}
