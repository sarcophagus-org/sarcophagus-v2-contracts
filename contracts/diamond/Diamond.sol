// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {LibDiamond} from "./libraries/LibDiamond.sol";
import {IDiamondCut} from "./interfaces/IDiamondCut.sol";

contract Diamond {
    constructor(address _contractOwner, address _diamondCutFacet) payable {
        LibDiamond.setContractOwner(_contractOwner);

        // Create an array of length 1 for facetCuts
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);

        // Create an array of length 1 for functionSelectors
        bytes4[] memory functionSelectors = new bytes4[](1);

        // Add the diamondCut external function from the diamondCutFacet to
        // functionSelectors
        functionSelectors[0] = IDiamondCut.diamondCut.selector;

        // Create a new facetCut including the functionSelectors array
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: _diamondCutFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: functionSelectors
        });

        // Make a diamond cut to form a facet from _diamondCutFacet including
        // the diamondCut function
        LibDiamond.diamondCut(cut, address(0), "");
    }

    // When an external function is called on a diamond its fallback function is
    // executed. The fallback function finds in the selectorToFacet mapping
    // which facet has the function that has been called and then executes that
    // function from the facet using delegatecall.
    //
    // A diamond’s fallback function and delegatecall enable a diamond to
    // execute a facet’s external function as its own external function. The
    // msg.sender and msg.value values do not change and only the diamond’s
    // contract storage is read and written to.
    //
    // In most other cases we should avoid complex fallback functions.
    // solhint-disable-next-line no-complex-fallback
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;

        // Get the diamond storage
        assembly {
            ds.slot := position
        }

        // Get the facet address from the facetAddressAndSelectorPosition
        // mapping using msg.sig as the function selector
        address facet = ds
            .facetAddressAndSelectorPosition[msg.sig]
            .facetAddress;

        // Check that the facet exists
        require(facet != address(0), "Function does not exist");

        // Assembly code that executes the function
        assembly {
            // Copy the function selector and any arguments
            calldatacopy(0, 0, calldatasize())

            // Execute the function call using the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)

            // Get any return value
            returndatacopy(0, 0, returndatasize())

            // Return any return value or error back to the caller
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    // Fallback function that accepts eth, does not need a function body
    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
