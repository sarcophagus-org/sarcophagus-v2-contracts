// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "../storage/LibAppStorage.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";

/**
 * @title Utility functions used within the Sarcophagus system
 * @notice This library implements various functions that are used throughout
 * Sarcophagus, mainly to DRY up the codebase
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

    /**
     * @notice Reverts if the input string is not empty
     * @param assetId the string to check
     */
    function confirmAssetIdNotSet(string memory assetId) public pure {
        require(bytes(assetId).length == 0, "assetId has already been set");
    }

    /**
     * @notice Reverts if existing assetId is not empty, or if new assetId is
     * @param existingAssetId the orignal assetId to check, make sure is empty
     * @param newAssetId the new assetId, which must not be empty
     */
    function assetIdsCheck(
        string memory existingAssetId,
        string memory newAssetId
    ) public pure {
        // verify that the existingAssetId is currently empty
        confirmAssetIdNotSet(existingAssetId);

        require(bytes(newAssetId).length > 0, "assetId must not have 0 length");
    }

    function archaeologistUnwrappedCheck(bytes32 sarcoId, address archaeologist)
        internal
        view
    {
        if (
            getArchaeologist(sarcoId, archaeologist).unencryptedShard.length > 0
        ) {
            revert LibErrors.ArchaeologistAlreadyUnwrapped(archaeologist);
        }
    }

    /**
     * @notice Given some bytes32 data, a signature, and an account, verify that the
     * identifier was signed by the account.
     * @dev The verifyBytes32Signature function is identical to the
     * verifyBytesSignature function except for the data type being passed in.
     * The reason these are split up is beacuse it's really tricky to convert a
     * bytes32 value into a bytes value and have ecrecover still work properly.
     * If a simple solution can be found for this problem then please combine
     * these two functions together.
     * @param data the data to verify
     * @param v signature element
     * @param r signature element
     * @param s signature element
     * @param account address to confirm data and signature came from
     */
    function verifyBytes32Signature(
        bytes32 data,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address account
    ) internal pure {
        // Hash the hash of the data payload
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(data))
            )
        );

        // Genearate the address from the signature.
        // ecrecover should always return a valid address.
        address hopefulAddress = ecrecover(messageHash, v, r, s);

        if (hopefulAddress != account) {
            revert LibErrors.SignatureFromWrongAccount(hopefulAddress, account);
        }
    }

    /**
     * @notice Given an identifier, a signature, and an account, verify that the
     * identifier was signed by the account.
     * @dev The verifyBytes32Signature function is identical to the
     * verifyBytesSignature function except for the data type being passed in.
     * The reason these are split up is beacuse it's really tricky to convert a
     * bytes32 value into a bytes value and have ecrecover still work properly.
     * If a simple solution can be found for this problem then please combine
     * these two functions together.
     * @param data the data to verify
     * @param v signature element
     * @param r signature element
     * @param s signature element
     * @param account address to confirm data and signature came from
     */
    function verifyBytesSignature(
        bytes memory data,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address account
    ) internal pure {
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
        address hopefulAddress = ecrecover(messageHash, v, r, s);

        if (hopefulAddress != account) {
            revert LibErrors.SignatureFromWrongAccount(hopefulAddress, account);
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
     * @notice Calculates the grace period that an archaeologist has after a
     * sarcophagus has reached its resurrection time
     * @param resurrectionTime the resurrection timestamp of a sarcophagus
     * @return the grace period
     * @dev The grace period is dependent on how far out the resurrection time
     * is. The longer out the resurrection time, the longer the grace period.
     * There is a minimum grace period of 30 minutes, otherwise, it's
     * calculated as 1% of the time between now and resurrection time.
     */
    function getGracePeriod(uint256 resurrectionTime)
        internal
        view
        returns (uint256)
    {
        // set a minimum window of 30 minutes
        uint16 minimumResurrectionWindow = 30 minutes;

        // calculate 1% of the relative time between now and the resurrection
        // time
        uint256 gracePeriod = (
            resurrectionTime > block.timestamp
                ? resurrectionTime - block.timestamp
                : block.timestamp - resurrectionTime
        ) / 100;

        // if our calculated grace period is less than the minimum time, we'll
        // use the minimum time instead
        if (gracePeriod < minimumResurrectionWindow) {
            gracePeriod = minimumResurrectionWindow;
        }

        // return that grace period
        return gracePeriod;
    }

    /**
     * @notice Reverts if we're not within the resurrection window (on either
     * side)
     * @param resurrectionTime the resurrection time of the sarcophagus
     * (absolute, i.e. a date time stamp)
     * @param resurrectionWindow the resurrection window of the sarcophagus
     * (relative, i.e. "30 minutes")
     */
    function unwrapTime(uint256 resurrectionTime, uint256 resurrectionWindow)
        internal
        view
    {
        // revert if too early
        if (resurrectionTime > block.timestamp) {
            revert LibErrors.TooEarlyToUnwrap(
                resurrectionTime,
                block.timestamp
            );
        }

        // revert if too late
        if (resurrectionTime + resurrectionWindow < block.timestamp) {
            revert LibErrors.TooLateToUnwrap(
                resurrectionTime,
                resurrectionWindow,
                block.timestamp
            );
        }
    }

    /// @notice Checks if the archaeologist exists on the sarcophagus.
    /// @param sarcoId the identifier of the sarcophagus
    /// @param archaeologist the address of the archaeologist
    /// @return The boolean true if the archaeologist exists on the sarcophagus
    function archaeologistExistsOnSarc(bytes32 sarcoId, address archaeologist)
        internal
        view
        returns (bool)
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // If the hashedShard on an archaeologist is 0 (which is its default
        // value), then the archaeologist doesn't exist on the sarcophagus
        return
            s.sarcophagusArchaeologists[sarcoId][archaeologist].hashedShard !=
            0;
    }

    /// @notice Gets an archaeologist given the sarcophagus identifier and the
    /// archaeologist's address.
    /// @param sarcoId the identifier of the sarcophagus
    /// @param archaeologist the address of the archaeologist
    /// @return The archaeologist
    function getArchaeologist(bytes32 sarcoId, address archaeologist)
        internal
        view
        returns (LibTypes.ArchaeologistStorage memory)
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        return s.sarcophagusArchaeologists[sarcoId][archaeologist];
    }

    /// @notice Checks if a sarcophagus has been finalized by checking if it
    /// contains any arweaveTxIds.
    /// @param sarcoId the identifier of the sarcophagus
    /// @return The boolean true if the sarcophagus has been finalized
    function isSarcophagusFinalized(bytes32 sarcoId)
        internal
        view
        returns (bool)
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        return s.sarcophagi[sarcoId].arweaveTxIds.length > 0;
    }

    /// @notice Calculates the protocol fees to be taken from the embalmer.
    /// @return The protocol fees amount
    function calculateProtocolFee() internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // TODO: Need feedback from the community to determine how protocol fees should be calculated
        // Just returns a constant value defined in an env file
        return s.protocolFee;
    }
}
