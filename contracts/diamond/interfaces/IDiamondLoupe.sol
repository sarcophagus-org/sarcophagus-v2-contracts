// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

// The DiamondLoupe interface as part of the diamond pattern
// EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535

// These functions are used externally to view a diamond's facets and functions
interface IDiamondLoupe {
    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }

    /// @notice Gets all facet addresses and their four byte function selectors
    /// @return facets_ The addresses of the facet contracts and their function
    /// selectors
    function facets() external view returns (Facet[] memory facets_);

    /// @notice Gets all the function selectors supported by a facet
    /// @param _facet The facet contract address
    /// @return facetFunctionSelectors_ The four byte functions selectors on the
    /// facet
    function facetFunctionSelectors(address _facet)
        external
        view
        returns (bytes4[] memory facetFunctionSelectors_);

    /// @notice Get all the facet addresses used by a diamond
    /// @return facetAddresses_ The addresses of the facets
    function facetAddresses()
        external
        view
        returns (address[] memory facetAddresses_);

    /// @notice Gets the facet that supports the given selector
    /// @dev If facet is not found return address(0).
    /// @param _functionSelector The function selector
    /// @return facetAddress_ The facet address
    function facetAddress(bytes4 _functionSelector)
        external
        view
        returns (address facetAddress_);
}
