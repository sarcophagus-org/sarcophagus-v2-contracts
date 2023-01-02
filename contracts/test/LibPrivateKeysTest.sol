// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {LibPrivateKeys} from "../libraries/LibPrivateKeys.sol";

contract LibPrivateKeysTest {
    bytes publicKey;

    event True();
    event False();

    function keyVerification(bytes32 privKey, bytes calldata pubKey) public {
        publicKey = pubKey;
        if (LibPrivateKeys.isPublicKeyFromPrivateKey(privKey, publicKey)) {
            emit True();
        } else {
            emit False();
        }
    }
}
