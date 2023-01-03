// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {LibUtils} from "../../../contracts/libraries/LibUtils.sol";
import {LibTypes} from "../../../contracts/libraries/LibTypes.sol";

contract LibUtilsTest {
    function verifySignature(
        bytes32 sarcoId,
        address paymentAddress,
        bytes calldata publicKey,
        LibTypes.Signature calldata signature
    ) external pure returns (bool) {
        return LibUtils.verifyAccusalSignature(sarcoId, paymentAddress, publicKey, signature);
    }
}
