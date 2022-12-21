// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";
import "../libraries/LibTypes.sol";

contract ThirdPartyFacet {
    AppStorage internal s;

    event AccuseArchaeologist(
        bytes32 indexed sarcoId,
        address indexed accuser,
        uint256 accuserBondReward,
        uint256 embalmerBondReward
    );

    event Clean(bytes32 indexed sarcoId, address indexed cleaner);
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

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

    /// @notice If archaeologists fail to publish their private keys on a sarcophagus before the end of the gracePeriod,
    /// their locked bonds and diggingFees may be claimed by either the embalmer or the admin
    /// embalmers may claim during a limited embalmerClaimWindow after the end of the gracePeriod, after that only the admin will
    /// be able to claim remaining locked bond and diggingFees
    /// @param sarcoId The identifier of the sarcophagus to clean
    function clean(bytes32 sarcoId) external {
        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];

        // Confirm the sarcophagus exists
        if (sarcophagus.resurrectionTime == 0) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm the sarcophagus has not been compromised
        if (sarcophagus.isCompromised) {
            revert LibErrors.SarcophagusCompromised(sarcoId);
        }

        // Confirm the sarcophagus is not buried
        if (sarcophagus.resurrectionTime == 2 ** 256 - 1) {
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

        // Confirm tx sender is embalmer or admin
        if (msg.sender != sarcophagus.embalmerAddress && msg.sender != LibDiamond.contractOwner()) {
            revert SenderNotEmbalmerOrAdmin(msg.sender);
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
        uint256 totalDiggingFeesAndLockedBonds = 0;
        for (uint256 i = 0; i < sarcophagus.cursedArchaeologistAddresses.length; i++) {
            LibTypes.CursedArchaeologist storage cursedArchaeologist = sarcophagus
                .cursedArchaeologists[sarcophagus.cursedArchaeologistAddresses[i]];
            if (!cursedArchaeologist.isAccused && cursedArchaeologist.privateKey == 0) {
                totalDiggingFeesAndLockedBonds += cursedArchaeologist.diggingFee; // add digging fee for cursedArchaeologist
                totalDiggingFeesAndLockedBonds += cursedArchaeologist.diggingFee; // add locked bond for cursedArchaeologist

                // slash the archaeologist's locked bond for the sarcophagus
                LibBonds.decreaseCursedBond(
                    sarcophagus.cursedArchaeologistAddresses[i],
                    cursedArchaeologist.diggingFee
                );

                // track that the archaeologist has had a clean on this sarcophagus
                s.archaeologistCleanups[sarcophagus.cursedArchaeologistAddresses[i]].push(sarcoId);
            }
        }

        // if caller is embalmer, transfer them the total locked bonds and digging fees
        if (msg.sender == sarcophagus.embalmerAddress) {
            s.sarcoToken.transfer(sarcophagus.embalmerAddress, totalDiggingFeesAndLockedBonds);
        }

        // if caller is admin, add total locked bonds and digging fees into protocolFees
        if (msg.sender == LibDiamond.contractOwner()) {
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
     * @param signatures an array of signatures of the sarcoId signed by the leaked private keys
     * @param paymentAddress the address to which rewards should be sent if successful
     */
    function accuse(
        bytes32 sarcoId,
        Signature[] calldata signatures,
        address paymentAddress
    ) external {
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
        if (sarcophagus.resurrectionTime == 2 ** 256 - 1) {
            revert LibErrors.SarcophagusInactive(sarcoId);
        }

        // build an array of the addresses of the archaeologists currently being accused
        address[] memory accusedArchAddresses = new address[](signatures.length);

        // track the combined locked bond across all archaeologists being accused in this call
        // locked bond will be equal to the amount of diggingFees allocated by the embalmer to pay the archaeologist
        uint256 totalDiggingFees = 0;
        uint256 accusalCount = 0;
        for (uint256 i = 0; i < signatures.length; i++) {
            // todo: obtain signing key for signature
            bytes memory publicKey = bytes("");
            // look up the archaeologist responsible for the publicKey
            address accusedArchaeologistAddress = s.publicKeyToArchaeologistAddress[publicKey];
            LibTypes.CursedArchaeologist storage accusedArchaeologist = sarcophagus
                .cursedArchaeologists[accusedArchaeologistAddress];

            // verify the accused archaeologist is cursed on the sarcophagus
            if (accusedArchaeologist.publicKey.length == 0) {
                revert LibErrors.ArchaeologistNotOnSarcophagus(msg.sender);
            }

            // if the archaeologist has already been accused on this sarcophagus break without taking action
            if (accusedArchaeologist.isAccused) {
                break;
            }

            // mark the archaeologist on the sarcophagus as having been accused
            accusedArchaeologist.isAccused = true;
            accusedArchAddresses[accusalCount++] = accusedArchaeologistAddress;

            // track the sum of all digging fees for all accused archaeologists
            totalDiggingFees += accusedArchaeologist.diggingFee;

            // slash the accused archaeologist's bond
            LibBonds.decreaseCursedBond(
                accusedArchaeologistAddress,
                accusedArchaeologist.diggingFee
            );

            // Save the accusal against the archaeologist
            s.archaeologistAccusals[accusedArchaeologistAddress].push(sarcoId);
        }

        // if none of the accusals were valid because the archaeologists have all already been accused, return without taking action
        if (accusalCount == 0) {
            return;
        }

        // the sarcophagus is compromised if the current call has successfully accused the sss threshold of archaeologists
        if (accusalCount >= sarcophagus.threshold) {
            sarcophagus.isCompromised = true;
        } else {
            // if the current call hasn't resulted in at least sss threshold archaeologists being accused
            // check if total number of historical accusals on sarcophagus is greater than threshold
            uint256 totalAccusals = 0;
            for (uint256 i = 0; i < sarcophagus.cursedArchaeologistAddresses.length; i++) {
                if (
                    sarcophagus
                        .cursedArchaeologists[sarcophagus.cursedArchaeologistAddresses[i]]
                        .isAccused
                ) {
                    totalAccusals++;
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
            for (uint256 i = 0; i < sarcophagus.cursedArchaeologistAddresses.length; i++) {
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
            }
        }

        // refund the diggingFees allocated by the embalmer to the accused archaeologists
        // split the total bond being slashed between the embalmer and the payment address
        (uint256 accuserBondReward, uint256 embalmerBondReward) = _distributeLoot(
            paymentAddress,
            sarcophagus,
            totalDiggingFees
        );

        emit AccuseArchaeologist(sarcoId, msg.sender, accuserBondReward, embalmerBondReward);
    }

    /**
     * @notice Takes a sarcophagus's digging fee, splits it in half, and sends
     * to paymentAddress and embalmer
     * @param paymentAddress payment address for the transaction caller
     * @param sarc the sarcophagus to operate on
     * @param totalDiggingFee the sum of digging fees of all archs that failed to fulfil their duties
     * @return halfToSender the amount of SARCO token going to transaction
     * sender
     * @return halfToEmbalmer the amount of SARCO token going to embalmer
     */
    function _distributeLoot(
        address paymentAddress,
        LibTypes.Sarcophagus storage sarc,
        uint256 totalDiggingFee
    ) private returns (uint256, uint256) {
        // split the sarcophagus's cursed bond into two halves
        uint256 halfToEmbalmer = totalDiggingFee / 2;
        uint256 halfToSender = totalDiggingFee - halfToEmbalmer;

        // transfer the cursed half, plus digging fee to the
        // embalmer
        s.sarcoToken.transfer(sarc.embalmerAddress, totalDiggingFee + halfToEmbalmer);

        // transfer the other half of the cursed bond to the transaction caller
        s.sarcoToken.transfer(paymentAddress, halfToSender);

        return (halfToSender, halfToEmbalmer);
    }

    function _hashHelper(bytes memory data) private pure returns (bytes32) {
        return keccak256(data);
    }
}
