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
     * @notice The archaeologist needs to sign off on two pieces of data
     * to guarantee their unrwap will be successful
     *
     * @param unencryptedShardDoubleHash the double hash of the unencrypted shard
     * @param arweaveTxId the arweave TX ID that contains the archs encrypted shard
     * @param v signature element
     * @param r signature element
     * @param s signature element
     * @param account address to confirm signature of data came from
     */
    function verifyArchaeologistSignature(
        bytes32 unencryptedShardDoubleHash,
        string memory arweaveTxId,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address account
    ) internal pure {
        // Hash the hash of the data payload
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(unencryptedShardDoubleHash, arweaveTxId))
            )
        );

        // Generate the address from the signature.
        // ecrecover should always return a valid address.
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
     * @notice Reverts if the current block timestamp is not within the resurrection window
     * (window = [resurrection time, resurrection time + grace period] inclusive)
     * @param resurrectionTime the resurrection time of the sarcophagus
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

        // If the doubleHashedShard on an archaeologist is 0 (which is its default value),
        // then the archaeologist doesn't exist on the sarcophagus
        return
            s
            .sarcophagusArchaeologists[sarcoId][archaeologist]
                .unencryptedShardDoubleHash != 0;
    }

    function revertIfArchProfileIs(bool existing, address archaeologist)
        internal
        view
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        if (existing ? s.archaeologistProfiles[archaeologist].exists : !s.archaeologistProfiles[archaeologist].exists) {
            revert LibErrors.ArchaeologistProfileExistsShouldBe(
                !existing,
                archaeologist
            );
        }
    }

    /// @notice Checks if an archaeologist profile exists and
    /// reverts if so
    ///
    /// @param archaeologist the archaeologist address to check existence of
    function revertIfArchProfileExists(address archaeologist)
        internal
        view
    {
        revertIfArchProfileIs(true, archaeologist);
    }

    /// @notice Checks if an archaeologist profile doesn't exist and
    /// reverts if so
    ///
    /// @param archaeologist the archaeologist address to check lack of existence of
    function revertIfArchProfileDoesNotExist(address archaeologist)
        internal
        view
    {
        revertIfArchProfileIs(false, archaeologist);
    }

    /// @notice Checks if digging fee the embalmer has supplied for
    /// an archaeologist is greater than or equal to the arch's min digging fee
    /// on their profile
    ///
    /// @param diggingFee the digging fee supplied by the embalmer
    /// @param archaeologist the archaeologist to check minimum digging fee of
    function revertIfDiggingFeeTooLow(uint256 diggingFee, address archaeologist)
        internal
        view
    {
        AppStorage storage s = LibAppStorage.getAppStorage();

        if (diggingFee < s.archaeologistProfiles[archaeologist].minimumDiggingFee) {
            revert LibErrors.DiggingFeeTooLow(diggingFee, archaeologist);
        }
    }

    /// @notice Checks if the resurrection time supplied for the sarcophagus
    /// is within the window that an archaeologist will accept
    ///
    /// @param resurrectionTime the resurrectionTime supplied for the sarcophagus
    /// @param archaeologist the archaeologist to check the max rewrap interval of
    function revertIfResurrectionTimeTooFarInFuture(uint256 resurrectionTime, address archaeologist)
        internal
        view
    {
        AppStorage storage s = LibAppStorage.getAppStorage();
        uint256 maxResurrectionTime = block.timestamp + s.archaeologistProfiles[archaeologist].maximumRewrapInterval;

        if (resurrectionTime > maxResurrectionTime) {
            revert LibErrors.ResurrectionTimeTooFarInFuture(resurrectionTime, archaeologist);
        }
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

    /// @notice Calculates the protocol fees to be taken from the embalmer.
    /// @return The protocol fees amount
    function calculateProtocolFees(uint256 totalDiggingFees) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();

        return totalDiggingFees * s.protocolFeeBasePercentage / 100;
    }

    /// @notice Generates a token id by hashing the sarcophagus id and the archaeologist address and
    /// converting it to a uint256
    /// @param _sarcoId the sarcophagus id.
    /// @param _archaeologist the archaeologist address.
    /// @return the token id.
    function generateTokenId(bytes32 _sarcoId, address _archaeologist)
        private
        returns (
            // pure
            uint256
        )
    {
        // Return the hash of the sarcoId and the archaeologist address as an uint256
        return uint256(keccak256(abi.encode(_sarcoId, _archaeologist)));
    }

    /// @notice Mints a curse token for an archaeologist on a sarcophagus
    /// @param sarcoId the sarcophagus id.
    /// @param archaeologist the archaeologist address.
    function mintCurseToken(bytes32 sarcoId, address archaeologist) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();

        uint256 tokenId = generateTokenId(sarcoId, archaeologist);

        LibTypes.MetadataAttributes memory attr = LibTypes.MetadataAttributes(
            s.sarcophagi[sarcoId].name,
            s.sarcophagusArchaeologists[sarcoId][archaeologist].diggingFee,
            s.sarcophagi[sarcoId].resurrectionTime,
            s.sarcophagusArchaeologists[sarcoId][archaeologist].diggingFeesPaid
        );

        // Mint a nft for the archaeologist
        s.curses.mint(
            archaeologist,
            tokenId,
            s.sarcophagi[sarcoId].name,
            "Represents an archaeologist's relationship with the sarcophagus",
            attr
        );

        // Add a record of the curse token id that was just minted on the
        // sarcophagusArchaeologists mapping. This is for when the contract needs to look up the
        // token id on transfer.
        s
        .sarcophagusArchaeologists[sarcoId][archaeologist]
            .curseTokenId = tokenId;
    }
}
