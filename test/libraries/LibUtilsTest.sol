// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {LibUtils} from "../../contracts/libraries/LibUtils.sol";

contract LibUtilsTest {
    function verifySignature(
        bytes calldata message,
        bytes calldata publicKey,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external pure returns (bool) {
        return LibUtils.verifyAccusalSignature(message, publicKey, v, r, s);
    }
}
