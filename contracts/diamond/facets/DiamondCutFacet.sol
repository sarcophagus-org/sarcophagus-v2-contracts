// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {IDiamondCut} from "../interfaces/IDiamondCut.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";

/// @title Diamond cut facet
/// @notice The facet that performs a diamond cut
/// @dev Part of the diamond pattern
/// EIP-2535 Diamonds: /// https://eips.ethereum.org/EIPS/eip-2535
contract DiamondCutFacet is IDiamondCut {
    /// @notice Add, replace, or remove any number of functions and optionally
    /// execute a function with delegatecall
    /// @dev The diamondCut method can be used to remove itself. This makes the
    /// diamond immutable. The diamond would then be called a "finished"
    /// diamond, since it's functions can no longer be modified.
    ///
    /// Authorization:
    /// By default only the owner of the contract may modify the diamond. The
    /// diamond pattern may allow a more elaborate authorization system to be
    /// set up.
    ///
    /// @param _diamondCut Contains the facet addresses and function selectors
    /// @param _init The address of the contract or facet to execute _calldata
    /// @param _calldata A function call, including function selector and
    /// arguments. _calldata is executed with delegatecall on _init.
    function diamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external override {
        // Make sure only the owner may modify the diamond
        LibDiamond.enforceIsContractOwner();
        LibDiamond.diamondCut(_diamondCut, _init, _calldata);
    }
}
