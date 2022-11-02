// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "../storage/LibAppStorage.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";

/**
 * @title Utility functions used within the Heritage system
 * @notice This library implements various functions that are used throughout
 * Heritage, mainly to DRY up the codebase
 * @dev these functions are all stateless, public, pure/view
 */
library LibUtils {
    /**
     * @notice Reverts if the public key length is not exactly 64 bytes long
     * @param publicKey the key to check length of
     */
    function publicKeyLength(bytes memory publicKey) public pure {
        require(publicKey.length == 64, "public key must be 64 bytes");
    }

    /**
     * @notice Reverts if the hash of singleHash does not equal doubleHash
     * @param doubleHash the hash to compare hash of singleHash to
     * @param singleHash the value to hash and compare against doubleHash
     */
    function hashCheck(bytes32 doubleHash, bytes memory singleHash)
        public
        pure
    {
        require(doubleHash == keccak256(singleHash), "hashes do not match");
    }

    function signatoryUnwrappedCheck(bytes32 vaultId, address signatory)
        internal
        view
    {
        if (
            getSignatory(vaultId, signatory).unencryptedShard.length > 0
        ) {
            revert LibErrors.SignatoryAlreadyUnwrapped(signatory);
        }
    }

    /**
     * @notice The signatory needs to sign off on two pieces of data
     * to guarantee their unrwap will be successful
     *
     * @param unencryptedShardDoubleHash the double hash of the unencrypted shard
     * @param arweaveTxId the arweave TX ID that contains the archs encrypted shard
     * @param agreedMaximumRewrapInterval that the signatory has agreed to for the vault
     * @param timestamp that the signatory has agreed to for the vault
     * @param diggingFee that the signatory has agreed to for the vault
     * @param v signature element
     * @param r signature element
     * @param s signature element
     * @param account address to confirm signature of data came from
     */
    function verifySignatorySignature(
        bytes32 unencryptedShardDoubleHash,
        string memory arweaveTxId,
        uint256 agreedMaximumRewrapInterval,
        uint256 timestamp,
        uint256 diggingFee,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address account
    ) internal pure {
        // Hash the hash of the data payload
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(arweaveTxId, unencryptedShardDoubleHash, agreedMaximumRewrapInterval, diggingFee, timestamp))
            )
        );

        // Generate the address from the signature.
        // ecrecover should always return a valid address.
        address recoveredAddress = ecrecover(messageHash, v, r, s);

        if (recoveredAddress != account) {
            revert LibErrors.InvalidSignature(recoveredAddress, account);
        }
    }

    /// @notice Returns the address that signed some data given the data and the
    /// signature.
    /// @param data the data to verify
    /// @param v signature element
    /// @param r signature element
    /// @param s signature element
    /// @return the address that signed the data
    function recoverAddress(
        bytes memory data,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal pure returns (address) {
        // Hash the hash of the data payload
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(data))
            )
        );

        // Genearate the address from the signature.
        // ecrecover should always return a valid address.
        // It's highly recommended that a hash be passed into ecrecover
        address account = ecrecover(messageHash, v, r, s);

        return account;
    }

    /**
     * @notice Reverts if the given resurrection time is not in the future
     * @param resurrectionTime the time to check against block.timestamp
     */
    function resurrectionInFuture(uint256 resurrectionTime) internal view {
        if (resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(resurrectionTime);
        }
    }

    /**
     * @notice Reverts if the current block timestamp is not within the resurrection window
     * (window = [resurrection time, resurrection time + grace period] inclusive)
     * @param resurrectionTime the resurrection time of the vault
     * (absolute, i.e. a date time stamp)
     */
    function unwrapTime(uint256 resurrectionTime) internal view {
        // revert if too early
        if (resurrectionTime > block.timestamp) {
            revert LibErrors.TooEarlyToUnwrap(
                resurrectionTime,
                block.timestamp
            );
        }
        AppStorage storage s = LibAppStorage.getAppStorage();

        // revert if too late
        if (resurrectionTime + s.gracePeriod < block.timestamp) {
            revert LibErrors.TooLateToUnwrap(
                resurrectionTime,
                s.gracePeriod,
                block.timestamp
            );
        }
    }

    /// @notice Checks if the signatory exists on the vault.
    /// @param vaultId the identifier of the vault
    /// @param signatory the address of the signatory
    /// @return The boolean true if the signatory exists on the vault
    function signatoryExistsOnSarc(bytes32 vaultId, address signatory)
        internal
        view
        returns (bool)
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // If the doubleHashedShard on an signatory is 0 (which is its default value),
        // then the signatory doesn't exist on the vault
        return
            s
            .vaultSignatories[vaultId][signatory]
                .unencryptedShardDoubleHash != 0;
    }

    /// @notice Checks if an signatory profile exists and
    /// reverts if so
    ///
    /// @param signatory the signatory address to check existence of
    function revertIfSignatoryProfileExists(address signatory)
        internal
        view
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        if (s.signatoryProfiles[signatory].exists) {
            revert LibErrors.SignatoryProfileExistsShouldBe(
                false,
                signatory
            );
        }
    }

    /// @notice Checks if an signatory profile doesn't exist and
    /// reverts if so
    ///
    /// @param signatory the signatory address to check lack of existence of
    function revertIfSignatoryProfileDoesNotExist(address signatory)
        internal
        view
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        if (!s.signatoryProfiles[signatory].exists) {
            revert LibErrors.SignatoryProfileExistsShouldBe(
                true,
                signatory
            );
        }
    }

    /// @notice Gets an signatory given the vault identifier and the
    /// signatory's address.
    /// @param vaultId the identifier of the vault
    /// @param signatory the address of the signatory
    /// @return The signatory
    function getSignatory(bytes32 vaultId, address signatory)
        internal
        view
        returns (LibTypes.SignatoryStorage memory)
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        return s.vaultSignatories[vaultId][signatory];
    }

    /// @notice Calculates the protocol fees to be taken from the testator.
    /// @return The protocol fees amount
    function calculateProtocolFees(uint256 totalDiggingFees) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();

        return totalDiggingFees * s.protocolFeeBasePercentage / 100;
    }
}
