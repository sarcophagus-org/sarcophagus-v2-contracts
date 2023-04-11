// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import "../storage/LibAppStorage.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import "../facets/ThirdPartyFacet.sol";
import "./LibTypes.sol";
import "../facets/EmbalmerFacet.sol";

/**
 * @title Utility functions used within the Sarcophagus system
 * @notice This library implements various functions that are used throughout
 * Sarcophagus, mainly to DRY up the codebase
 * @dev these functions are all stateless, public, pure/view
 */
library LibUtils {
    /**
     * @notice The archaeologist needs to sign off on two pieces of data
     * to guarantee their unrwap will be successful
     *
     * @param agreedMaximumRewrapInterval that the archaeologist has agreed to for the sarcophagus
     * @param timestamp that the archaeologist has agreed to for the sarcophagus
     * @param curseParams parameters of curse signed by archaeologist
     */
    function verifyArchaeologistSignature(
        uint256 agreedMaximumRewrapInterval,
        uint256 maximumResurrectionTime,
        uint256 timestamp,
        EmbalmerFacet.CurseParams calldata curseParams
    ) internal pure {
        // Hash the hash of the data payload
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encode(
                        curseParams.publicKey,
                        agreedMaximumRewrapInterval,
                        maximumResurrectionTime,
                        curseParams.diggingFeePerSecond,
                        timestamp
                    )
                )
            )
        );

        // Generate the address from the signature.
        // ecrecover should always return a valid address.
        address recoveredAddress = ecrecover(
            messageHash,
            curseParams.v,
            curseParams.r,
            curseParams.s
        );

        if (recoveredAddress != curseParams.archAddress) {
            revert LibErrors.InvalidSignature(recoveredAddress, curseParams.archAddress);
        }
    }

    /// @notice Verifies that a signature and public key were created from the same private key
    /// @param sarcoId the sarcoId that was signed
    /// @param paymentAddress the payment address that was signed
    /// @param publicKey an uncompressed 65 byte secp256k1 public key
    /// @param signature signature on the sarco id and payment address
    /// @return true if the signature was signed by the private key corresponding to the supplied public key
    function verifyAccusalSignature(
        bytes32 sarcoId,
        address paymentAddress,
        bytes calldata publicKey,
        LibTypes.Signature calldata signature
    ) internal pure returns (bool) {
        // removes the 0x04 prefix from an uncompressed public key
        bytes memory truncatedPublicKey = new bytes(publicKey.length - 1);
        for (uint256 i = 1; i < publicKey.length; i++) {
            truncatedPublicKey[i - 1] = publicKey[i];
        }
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(sarcoId, paymentAddress))
            )
        );
        // Use ecrecover to get the address that signed the message
        address signingAddress = ecrecover(messageHash, signature.v, signature.r, signature.s);

        address publicKeyAddress = address(
            uint160(
                uint256(keccak256(truncatedPublicKey)) &
                    0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
            )
        );

        return signingAddress == publicKeyAddress;
    }

    /// @notice Checks if an archaeologist profile exists and
    /// reverts if so
    ///
    /// @param archaeologist the archaeologist address to check existence of
    function revertIfArchProfileExists(address archaeologist) internal view {
        AppStorage storage s = LibAppStorage.getAppStorage();

        if (s.archaeologistProfiles[archaeologist].maximumRewrapInterval != 0) {
            revert LibErrors.ArchaeologistProfileExistsShouldBe(false, archaeologist);
        }
    }

    /// @notice Checks if an archaeologist profile doesn't exist and reverts if so
    ///
    /// @param archaeologist the archaeologist address to check lack of existence of
    function revertIfArchProfileDoesNotExist(address archaeologist) internal view {
        AppStorage storage s = LibAppStorage.getAppStorage();

        if (s.archaeologistProfiles[archaeologist].maximumRewrapInterval == 0) {
            revert LibErrors.ArchaeologistProfileExistsShouldBe(true, archaeologist);
        }
    }

    /// @notice Calculates the protocol fees to be taken from the embalmer.
    /// @param totalDiggingFees to be paid. Protocol fee is a percentage of this
    /// @return The protocol fees amount
    function calculateProtocolFees(uint256 totalDiggingFees) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();

        return (totalDiggingFees * s.protocolFeeBasePercentage) / 100;
    }
}
