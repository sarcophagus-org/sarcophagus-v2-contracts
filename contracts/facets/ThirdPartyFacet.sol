// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract ThirdPartyFacet {
    AppStorage internal s;

    event AccuseArchaeologist(
        bytes32 indexed sarcoId,
        address indexed accuser,
        uint256 accuserBondReward,
        uint256 embalmerBondReward
    );

    event CleanUpSarcophagus(
        bytes32 indexed sarcoId,
        address indexed cleaner,
        uint256 cleanerBondReward,
        uint256 embalmerBondReward
    );

    /// @notice Close a sarcophagus that has not been unwrapped within its grace period
    /// @param sarcoId The identifier of the sarcophagus to clean
    /// @param paymentAddress The address to which rewards will be sent
//    function clean(bytes32 sarcoId, address paymentAddress) external {
//        LibUtils.revertIfNotExistOrInactive(sarcoId);
//
//        LibTypes.Sarcophagus storage sarco = s.sarcophagi[sarcoId];
//
//        // Make sure the sarco is cleanable
//        if (block.timestamp < s.gracePeriod + sarco.resurrectionTime) {
//            revert LibErrors.SarcophagusNotCleanable();
//        }
//
//        // Figure out which archaeoligists did not fulfil their duties;
//        // accumulate their digging fees
//        address[] memory archAddresses = sarco.archaeologists;
//
//        uint256 totalDiggingFee;
//
//        for (uint256 i = 0; i < archAddresses.length; i++) {
//            // todo: consider skipping this mapping and just retrieving the keyshares
//            bool didNotUnwrap = s.archaeologistSarcoSuccesses[archAddresses[i]][sarcoId] == false;
//
//            if (didNotUnwrap) {
//                LibTypes.ArchaeologistStorage memory defaulter = s.sarcophagusArchaeologists[
//                    sarcoId
//                ][archAddresses[i]];
//
//                totalDiggingFee += defaulter.diggingFee;
//
//                // decrease the defaulter's cursed bond
//                LibBonds.decreaseCursedBond(archAddresses[i], defaulter.diggingFee);
//
//                // Save the failure to unwrap against the archaeologist
//                s.archaeologistCleanups[archAddresses[i]].push(sarcoId);
//            }
//        }
//
//        (uint256 cleanerBondReward, uint256 embalmerBondReward) = _distributeLoot(
//            paymentAddress,
//            sarco,
//            totalDiggingFee
//        );
//
//        sarco.state = LibTypes.SarcophagusState.Cleaned;
//
//        emit CleanUpSarcophagus(sarcoId, msg.sender, cleanerBondReward, embalmerBondReward);
//    }

    /**
     * @notice Accuse one or more archaeologists of leaking key shares by submitting the hashes of the leaked shares
     * If the archaeologists responsible for those shares haven't already been accused, their locked bond will be
     * split between the embalmer and the supplied payment address and digging fees allocated for those archaeologists will be refunded to the embalmer
     *
     * If k or more archaeologists are accused over the lifetime of a sarcophagus, the sarcophagus state will be updated to Accused
     * and bonds for all remaining archaeologists will be freed
     *
     * Should not be called on a buried or compromised sarcophagus.
     *
     * @param sarcoId The identifier of the sarcophagus having leaked shares
     * @param keyShareHashes hashes of the leaked key shares
     * @param paymentAddress the address to which rewards should be sent if successful
     */
    function accuse(
        bytes32 sarcoId,
        bytes32[] calldata keyShareHashes,
        address paymentAddress
    ) external {
        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];

        // Confirm sarcophagus exists
        if (sarcophagus.resurrectionTime == 0) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // verify that current time is not past resurrection time
        if (block.timestamp > sarcophagus.resurrectionTime) {
            revert LibErrors.SarcophagusIsUnwrappable();
        }

        // Confirm the sarcophagus has not been compromised
        if (sarcophagus.isCompromised) {
            revert LibErrors.SarcophagusCompromised(sarcoId);
        }

        // Confirm the sarcophagus is not buried
        if (sarcophagus.resurrectionTime == 2**256 - 1) {
            revert LibErrors.SarcophagusInactive(sarcoId);
        }

        // build an array of the addresses of the archaeologists currently being accused
        address[] memory accusedArchAddresses = new address[](keyShareHashes.length);

        // track the combined locked bond across all archaeologists being accused in this call
        // locked bond will be equal to the amount of diggingFees allocated by the embalmer to pay the archaeologist
        uint256 totalDiggingFees = 0;
        uint256 accusalCount = 0;
        for (uint256 i = 0; i < keyShareHashes.length; i++) {
            // generate the double hash of the key share
            bytes32 doubleHashedKeyShare = keccak256(abi.encode(keyShareHashes[i]));

            // look up the archaeologist responsible for the key share
            address accusedArchaeologistAddress = s.doubleHashedShardArchaeologists[doubleHashedKeyShare];
            LibTypes.CursedArchaeologist storage accusedArchaeologist = sarcophagus.cursedArchaeologists[accusedArchaeologistAddress];

            // verify the accused archaeologist is cursed on the sarcophagus
            if (accusedArchaeologist.doubleHashedKeyShare.length == 0) {
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
            LibBonds.decreaseCursedBond(accusedArchaeologistAddress, accusedArchaeologist.diggingFee);

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
            for (uint256 i = 0; i < sarcophagus.archaeologistAddresses.length; i++) {
                if (sarcophagus.cursedArchaeologists[sarcophagus.archaeologistAddresses[i]].isAccused) {
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
            for (uint256 i = 0; i < sarcophagus.archaeologistAddresses.length; i++) {
                // if the archaeologist has never been accused, release their locked bond back to them
                if (!sarcophagus.cursedArchaeologists[sarcophagus.archaeologistAddresses[i]].isAccused) {
                    LibBonds.freeArchaeologist(sarcoId, sarcophagus.archaeologistAddresses[i]);
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
        s.sarcoToken.transfer(sarc.embalmer, totalDiggingFee + halfToEmbalmer);

        // transfer the other half of the cursed bond to the transaction caller
        s.sarcoToken.transfer(paymentAddress, halfToSender);

        return (halfToSender, halfToEmbalmer);
    }

    function _hashHelper(bytes memory data) private pure returns (bytes32) {
        return keccak256(data);
    }
}
