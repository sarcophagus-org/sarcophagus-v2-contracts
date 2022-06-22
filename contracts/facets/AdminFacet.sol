// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {LibDiamond} from "../diamond/libraries/LibDiamond.sol";

contract AdminFacet {
    function updateProtocolFee(uint256 protocolFee) external {
        LibDiamond.enforceIsContractOwner();
    }
}
