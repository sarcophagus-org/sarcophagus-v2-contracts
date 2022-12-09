// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {LibPrivateKeys} from "../libraries/LibPrivateKeys.sol";

contract LibPrivateKeysTest {
    function keyVerification(bytes32 privKey, bytes memory pubKey) public pure returns (bool) {
        return LibPrivateKeys.keyVerification(privKey, pubKey);
    }
}
