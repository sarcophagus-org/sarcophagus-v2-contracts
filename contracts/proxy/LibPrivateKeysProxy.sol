// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {LibPrivateKeys} from "../libraries/LibPrivateKeys.sol";

contract LibPrivateKeysTest {
    bytes storedPublicKey;

    event True();
    event False();

    function keyVerification(bytes32 privKey, bytes calldata pubKey) public {
        storedPublicKey = pubKey;
        if (LibPrivateKeys.isPublicKeyOfPrivateKey(privKey, storedPublicKey)) {
            emit True();
        } else {
            emit False();
        }
    }
}
