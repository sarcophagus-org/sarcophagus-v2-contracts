// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import "../storage/LibAppStorage.sol";
import "../libraries/LibTypes.sol";

contract ThirdPartyFacet {
    using SafeERC20 for IERC20;

    event AccuseArchaeologist(
        bytes32 indexed sarcoId,
        address indexed accuser,
        uint256 totalSlashedBondDistributed,
        uint256 totalDiggingFeesDistributed,
        address[] indexed accusedArchAddresses
    );

    event Clean(bytes32 indexed sarcoId, address indexed cleaner);

    /// @notice Clean has been called on a sarcophagus that has already been cleaned
    /// @param sarcoId ID of sarcophagus archaeologist has attempted to publish a private key on
    error SarcophagusAlreadyCleaned(bytes32 sarcoId);

    /// @notice Clean has been called before the deadline for archaeologists to publish private keys has passed
    /// @param currentTime Timestamp of the failed clean attempt
    /// @param publishDeadline Latest time an archaeologist may publish a private key on a sarcophagus: resurrectionTime + gracePeriod
    error TooEarlyForClean(uint256 currentTime, uint256 publishDeadline);

    /// @notice Clean has been called by someone other than the admin or embalmer of the sarcophagus
    /// @param senderAddress Address of sender
    error SenderNotEmbalmerOrAdmin(address senderAddress);

    /// @notice Embalmer has attempted to clean a sarcophagus after the embalmerClaimWindow has passed
    /// @param currentTime Timestamp of the failed clean attempt
    /// @param embalmerClaimWindowEnd Latest time an embalmer may claim residual locked bonds the sarcophagus: resurrectionTime + gracePeriod + embalmerClaimWindow
    error EmbalmerClaimWindowPassed(uint256 currentTime, uint256 embalmerClaimWindowEnd);

    /// @notice Admin has attempted to clean a sarcophagus before the embalmerClaimWindow has passed
    /// @param currentTime Timestamp of the failed clean attempt
    /// @param embalmerClaimWindowEnd Latest time an embalmer may claim residual locked bonds the sarcophagus: resurrectionTime + gracePeriod + embalmerClaimWindow
    error TooEarlyForAdminClean(uint256 currentTime, uint256 embalmerClaimWindowEnd);

    /// @notice Emitted when a third party attempts to accuse an archaeologist on a sarcophagus where the resurrection time has already passed
    /// @param currentTime Timestamp of the failed accuse attempt
    /// @param resurrectionTime Resurrection timestamp which has already passed
    error ResurrectionTimeInPast(uint256 currentTime, uint256 resurrectionTime);

    /// @notice Emitted when accuse is called with an unequal numbers of public keys and signatures
    /// @param signatures the number of signatures passed into the accuse call
    /// @param publicKeys the number of public keys passed into the accuse call
    error DifferentNumberOfSignaturesAndPublicKeys(uint256 signatures, uint256 publicKeys);

    /// @notice Emitted when accuse is called with an invalid signature for the supplied sarcoId, paymentAddress, and publicKey
    /// @param sarcoId that should have been signed
    /// @param paymentAddress payment address that should have been signed
    /// @param publicKey publicKey that should be derived from signing key
    /// @param signature invalid signature
    error InvalidAccusalSignature(
        bytes32 sarcoId,
        address paymentAddress,
        bytes publicKey,
        LibTypes.Signature signature
    );

    /// @notice If archaeologists fail to publish their private keys on a sarcophagus before the end of the gracePeriod,
    /// their locked bonds and diggingFees may be claimed by either the embalmer or the admin
    /// embalmers may claim during a limited embalmerClaimWindow after the end of the gracePeriod, after that only the admin will
    /// be able to claim remaining locked bond and diggingFees
    /// @param sarcoId The identifier of the sarcophagus to clean
    function clean(bytes32 sarcoId) external {
        AppStorage storage s = LibAppStorage.getAppStorage();
        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];

        // Confirm the sarcophagus exists
        if (sarcophagus.resurrectionTime == 0) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm tx sender is embalmer or admin
        if (msg.sender != sarcophagus.embalmerAddress && msg.sender != LibDiamond.contractOwner()) {
            revert SenderNotEmbalmerOrAdmin(msg.sender);
        }

        // Confirm the sarcophagus has not been compromised
        if (sarcophagus.isCompromised) {
            revert LibErrors.SarcophagusCompromised(sarcoId);
        }

        // Confirm the sarcophagus is not buried
        if (sarcophagus.resurrectionTime == type(uint256).max) {
            revert LibErrors.SarcophagusInactive(sarcoId);
        }

        // Confirm the sarcophagus has not already been cleaned
        if (sarcophagus.isCleaned) {
            revert SarcophagusAlreadyCleaned(sarcoId);
        }

        // Confirm that the resurrectionTime + gracePeriod have passed
        if (block.timestamp <= sarcophagus.resurrectionTime + s.gracePeriod) {
            revert TooEarlyForClean(block.timestamp, sarcophagus.resurrectionTime + s.gracePeriod);
        }

        // if sender is embalmer, confirm current time is within embalmerClaimWindow
        if (
            msg.sender == sarcophagus.embalmerAddress &&
            block.timestamp > sarcophagus.resurrectionTime + s.gracePeriod + s.embalmerClaimWindow
        ) {
            revert EmbalmerClaimWindowPassed(
                block.timestamp,
                sarcophagus.resurrectionTime + s.gracePeriod + s.embalmerClaimWindow
            );
        }

        // if sender is admin, confirm embalmerClaimWindow has passed
        if (
            msg.sender == LibDiamond.contractOwner() &&
            block.timestamp <= sarcophagus.resurrectionTime + s.gracePeriod + s.embalmerClaimWindow
        ) {
            revert TooEarlyForAdminClean(
                block.timestamp,
                sarcophagus.resurrectionTime + s.gracePeriod + s.embalmerClaimWindow
            );
        }

        // sum of locked bonds and digging fees for all archaeologists that have failed to publish private keys before publish deadline and have not been accused
        uint256 totalDiggingFeesAndLockedBonds;
        uint256 nCursedArchs = sarcophagus.cursedArchaeologistAddresses.length;

        for (uint256 i; i < nCursedArchs; ) {
            LibTypes.CursedArchaeologist storage cursedArchaeologist = sarcophagus
                .cursedArchaeologists[sarcophagus.cursedArchaeologistAddresses[i]];

            // Punish archaeologists that failed to publish their private key in time
            if (!cursedArchaeologist.isAccused && cursedArchaeologist.privateKey == 0) {
                uint256 diggingFeesDue = cursedArchaeologist.diggingFeePerSecond *
                    (sarcophagus.resurrectionTime - sarcophagus.previousRewrapTime);

                if (!sarcophagus.isRewrapped) {
                    diggingFeesDue += cursedArchaeologist.curseFee;
                }

                uint256 cursedBondDue = (diggingFeesDue * sarcophagus.cursedBondPercentage) / 100;
                totalDiggingFeesAndLockedBonds += diggingFeesDue + cursedBondDue;

                // slash the archaeologist's locked bond for the sarcophagus
                LibBonds.decreaseCursedBond(
                    sarcophagus.cursedArchaeologistAddresses[i],
                    cursedBondDue
                );
            }
            unchecked {
                ++i;
            }
        }

        // Transfer total slashed locked bonds plus digging fees to the embalmer if they are the caller, otherwise add
        // this to the contract's protocol fees
        if (msg.sender == sarcophagus.embalmerAddress) {
            s.sarcoToken.safeTransfer(sarcophagus.embalmerAddress, totalDiggingFeesAndLockedBonds);
        } else {
            s.totalProtocolFees += totalDiggingFeesAndLockedBonds;
        }

        sarcophagus.isCleaned = true;
        emit Clean(sarcoId, msg.sender);
    }

    /**
     * @notice Accuse one or more archaeologists of leaking private keys by submitting signatures on the sarco id
     * and payment address generated with the leaked private keys
     * If the archaeologists responsible for those private keys haven't already been accused, their locked bond will be
     * split between the embalmer and the supplied payment address and digging fees allocated for those archaeologists will be refunded to the embalmer
     *
     * If k or more archaeologists are accused over the lifetime of a sarcophagus, the sarcophagus
     * state will be updated to Accused and bonds for all remaining unaccused archaeologists will be
     * returned
     *
     * @param sarcoId The identifier of the sarcophagus having leaked private keys
     * @param publicKeys an array of public keys corresponding to leaked private keys - order must match order of signatures
     * @param signatures an array of signatures of the sarcoId and payment address signed by the leaked private keys - order must match order of publicKeys
     * @param paymentAddress the address to which rewards should be sent if successful
     */
    function accuse(
        bytes32 sarcoId,
        bytes[] calldata publicKeys,
        LibTypes.Signature[] calldata signatures,
        address paymentAddress
    ) external {
        AppStorage storage s = LibAppStorage.getAppStorage();
        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];

        // Confirm sarcophagus exists
        if (sarcophagus.resurrectionTime == 0) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // verify that current time is not past resurrection time
        if (block.timestamp > sarcophagus.resurrectionTime) {
            revert ResurrectionTimeInPast(block.timestamp, sarcophagus.resurrectionTime);
        }

        // Confirm the sarcophagus has not been compromised
        if (sarcophagus.isCompromised) {
            revert LibErrors.SarcophagusCompromised(sarcoId);
        }

        // Confirm the sarcophagus is not buried
        if (sarcophagus.resurrectionTime == type(uint256).max) {
            revert LibErrors.SarcophagusInactive(sarcoId);
        }

        uint256 nSigs = signatures.length;

        if (nSigs != publicKeys.length) {
            revert DifferentNumberOfSignaturesAndPublicKeys(nSigs, publicKeys.length);
        }

        address[] memory accusedArchAddresses = new address[](nSigs);

        // track the combined locked bond across all archaeologists being accused in this call
        uint256 totalCursedBond;
        uint256 accusalCount;
        for (uint256 i; i < nSigs; ) {
            if (
                !LibUtils.verifyAccusalSignature(
                    sarcoId,
                    paymentAddress,
                    publicKeys[i],
                    signatures[i]
                )
            ) {
                revert InvalidAccusalSignature(
                    sarcoId,
                    paymentAddress,
                    publicKeys[i],
                    signatures[i]
                );
            }

            // look up the archaeologist responsible for the publicKey
            address accusedArchaeologistAddress = s.publicKeyToArchaeologistAddress[publicKeys[i]];
            LibTypes.CursedArchaeologist storage accusedArchaeologist = sarcophagus
                .cursedArchaeologists[accusedArchaeologistAddress];

            // verify the accused archaeologist is cursed on the sarcophagus
            if (accusedArchaeologist.publicKey.length == 0) {
                revert LibErrors.ArchaeologistNotOnSarcophagus(msg.sender);
            }

            // if the archaeologist has already been accused on this sarcophagus skip them without taking action
            if (accusedArchaeologist.isAccused) {
                unchecked {
                    ++i;
                }
                continue;
            }

            // mark the archaeologist on the sarcophagus as having been accused
            accusedArchaeologist.isAccused = true;
            accusedArchAddresses[accusalCount++] = accusedArchaeologistAddress;

            uint256 cursedBondDue = ((accusedArchaeologist.diggingFeePerSecond *
                (sarcophagus.resurrectionTime - sarcophagus.previousRewrapTime)) *
                sarcophagus.cursedBondPercentage) / 100;

            // If the sarcophagus has not been rewrapped, also slash the curse fee
            if (!sarcophagus.isRewrapped) {
                cursedBondDue += accusedArchaeologist.curseFee * sarcophagus.cursedBondPercentage / 100;
            }

            totalCursedBond += cursedBondDue;

            // Slash the offending archaeologists bond
            LibBonds.decreaseCursedBond(accusedArchaeologistAddress, cursedBondDue);
            unchecked {
                ++i;
            }
        }

        // if none of the accusals were valid because the archaeologists have all already been accused, return without taking action
        if (accusalCount == 0) {
            return;
        }

        {
            uint256 nCursedArchs = sarcophagus.cursedArchaeologistAddresses.length;

            // the sarcophagus is compromised if the current call has successfully accused the sss threshold of archaeologists
            if (accusalCount >= sarcophagus.threshold) {
                sarcophagus.isCompromised = true;
            } else {
                // if the current call hasn't resulted in at least sss threshold archaeologists being accused
                // check if total number of historical accusals on sarcophagus is greater than threshold
                uint256 totalAccusals;

                for (uint256 i; i < nCursedArchs; ) {
                    if (
                        sarcophagus
                            .cursedArchaeologists[sarcophagus.cursedArchaeologistAddresses[i]]
                            .isAccused
                    ) {
                        ++totalAccusals;
                    }
                    unchecked {
                        ++i;
                    }
                }
                // the sarcophagus is compromised if k or more archaeologists have been accused over the lifetime of the sarcophagus
                if (totalAccusals >= sarcophagus.threshold) {
                    sarcophagus.isCompromised = true;
                }
            }

            // if k or more archaeologists have been accused over the lifetime of the sarcophagus, funds should
            // be returned to the remaining well behaved archaeologists
            if (sarcophagus.isCompromised) {
                // iterate through all archaeologist addresses on the sarcophagus
                for (uint256 i; i < nCursedArchs; ) {
                    // if the archaeologist has never been accused, release their locked bond back to them
                    if (
                        !sarcophagus
                            .cursedArchaeologists[sarcophagus.cursedArchaeologistAddresses[i]]
                            .isAccused
                    ) {
                        LibBonds.freeArchaeologist(
                            sarcoId,
                            sarcophagus.cursedArchaeologistAddresses[i]
                        );
                    }
                    unchecked {
                        ++i;
                    }
                }
            }
        }

        uint256 halfTotalCursedBond = totalCursedBond >> 1;
        uint256 totalDiggingFees = totalCursedBond / (sarcophagus.cursedBondPercentage / 100);
        // transfer the cursed half, plus the current digging fees, to the embalmer
        s.sarcoToken.safeTransfer(
            sarcophagus.embalmerAddress,
            totalDiggingFees + halfTotalCursedBond
        );

        // transfer the other half of the cursed bond to the transaction caller
        s.sarcoToken.safeTransfer(paymentAddress, halfTotalCursedBond);

        emit AccuseArchaeologist(
            sarcoId,
            msg.sender,
            totalCursedBond,
            totalDiggingFees,
            accusedArchAddresses
        );
    }
}
