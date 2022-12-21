// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;


/**
 * @title Private key verification
 * @notice Implements a private key -> public key checking function
 * @dev modified from https://github.com/1Address/ecsol, removes extra code
 * which isn't necessary for our Sarcophagus implementation
 */
library LibPrivateKeys {
    /**
     * @notice Given a private key and a public key, determines if that public
     * key was derived from the private key
     * @dev based on https://ethresear.ch/t/you-can-kinda-abuse-ecrecover-to-do-ecmul-in-secp256k1-today/2384/9
     * @param privKey an secp256k1 private key
     * @param pubKey an uncompressed 65 byte secp256k1 public key
     * @return bool indicating whether the public key is derived from the
     * private key
     */
    function isPublicKeyFromPrivateKey(bytes32 privKey, bytes memory pubKey) internal pure returns (bool) {
        // removes the 0x04 prefix from an uncompressed public key
        bytes memory truncatedPublicKey = new bytes(pubKey.length-1);
        for (uint256 i = 1; i < pubKey.length; i++) {
            truncatedPublicKey[i-1] = pubKey[i];
        }

        // generator point coordinates and order of secp256k1
        uint256 gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798;
        uint256 gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8;
        uint256 m = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

        address signer = ecrecover(
            0,
            gy % 2 != 0 ? 28 : 27,
            bytes32(gx),
            bytes32(mulmod(uint256(privKey), gx, m))
        );

        address xyAddress = address(
            uint160(uint256(keccak256(truncatedPublicKey)) & 0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
        );
        return xyAddress == signer;
    }
}
