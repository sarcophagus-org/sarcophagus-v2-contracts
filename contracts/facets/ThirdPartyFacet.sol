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
    function clean(bytes32 sarcoId, address paymentAddress) external {
        LibUtils.revertIfNotExistOrInactive(sarcoId);

        LibTypes.Sarcophagus storage sarco = s.sarcophagi[sarcoId];

        // Make sure the sarco is cleanable
        if (block.timestamp < s.gracePeriod + sarco.resurrectionTime) {
            revert LibErrors.SarcophagusNotCleanable();
        }

        // Figure out which archaeoligists did not fulfil their duties;
        // accumulate their digging fees
        address[] memory archAddresses = sarco.archaeologists;

        uint256 totalCursedBond;
        uint256 totalDiggingFee;

        for (uint256 i = 0; i < archAddresses.length; i++) {
            bool didNotUnwrap = s.archaeologistSarcoSuccesses[archAddresses[i]][
                sarcoId
            ] == false;

            if (didNotUnwrap) {
                LibTypes.ArchaeologistStorage memory defaulter = s
                    .sarcophagusArchaeologists[sarcoId][archAddresses[i]];

                totalDiggingFee += defaulter.diggingFee;

                uint256 cursedBond = defaulter.diggingFee;

                totalCursedBond += cursedBond;

                // decrease the defaulter's cursed bond
                LibBonds.decreaseCursedBond(archAddresses[i], cursedBond);

                // Save the failure to unwrap against the archaeologist
                s.archaeologistCleanups[archAddresses[i]].push(sarcoId);
            }
        }

        (
            uint256 cleanerBondReward,
            uint256 embalmerBondReward
        ) = _distributeLoot(
                paymentAddress,
                sarco,
                totalCursedBond,
                totalDiggingFee
            );

        sarco.state = LibTypes.SarcophagusState.Cleaned;

        emit CleanUpSarcophagus(
            sarcoId,
            msg.sender,
            cleanerBondReward,
            embalmerBondReward
        );
    }

    /**
     * @notice Accuse archaeologists of leaking keyshares prior to a sarcophagus's resurrection time by supplying
     * the hashes of the leaked keyshares. If the archaeologists responsible for those shares
     * haven't already been accused, their locked bond will be split between the embalmer and the supplied payment address and
     * diggingFees allocated for those archaeologists will be refunded to the embalmer.
     * If k or more archaeologists are accused over the lifetime of a sarcophagus, the sarcophagus state will be updated to Accused
     * and bonds for all remaining archaeologists will be freed
     *
     * @param sarcoId The identifier of the sarcophagus having leaked shards
     * @param unencryptedShardHashes hashes of the leaked keyshares
     * @param paymentAddress the address to which rewards should be sent if successful
     */
    function accuse(
        bytes32 sarcoId,
        bytes32[] memory unencryptedShardHashes,
        address paymentAddress
    ) external {
        // verify that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state == LibTypes.SarcophagusState.DoesNotExist) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        LibTypes.Sarcophagus storage sarco = s.sarcophagi[sarcoId];

        // verify that the resurrection time has not yet passed
        if (sarco.resurrectionTime < block.timestamp) {
            revert LibErrors.SarcophagusIsUnwrappable();
        }

        // build an array of the addresses of the archaeologists currently being accused
        address[] memory accusedArchAddresses = new address[](
            unencryptedShardHashes.length
        );

        // track the combined locked bond across all archaeologists being accused in this call
        //  will be equal to the amount of diggingFees allocated by the embalmer to pay the archaeologist
        uint256 totalDiggingFees = 0;
        uint accusalCount = 0;
        for (uint256 i = 0; i < unencryptedShardHashes.length; i++) {
            // generate the double hash of the keyshare
            bytes32 shardDoubleHash = keccak256(abi.encode(unencryptedShardHashes[i]));

            // look up the archaeologist responsible for the keyshare
            address accusedArchaeologistAddress = s.doubleHashedShardArchaeologists[shardDoubleHash];
            LibTypes.ArchaeologistStorage storage badArch = s
                .sarcophagusArchaeologists[sarcoId][accusedArchaeologistAddress];

            // if the archaeologist has already been accused on this sarcophagus break without taking action
            if (badArch.accused) {
                break;
            }

            // mark the archaeologist on the sarcophagus as having been accused
            badArch.accused = true;
            accusedArchAddresses[accusalCount++] = accusedArchaeologistAddress;

            // track the sum of all digging fees for all accused archaeologists
            totalDiggingFees += badArch.diggingFee;

            // slash the accused archaeologist's bond
            LibBonds.decreaseCursedBond(accusedArchaeologistAddress, badArch.diggingFee);

            // Save the accusal against the archaeologist
            s.archaeologistAccusals[accusedArchaeologistAddress].push(sarcoId);
        }

        // if none of the accusals were valid because the archaeologists have already been accused, return without taking action
        if (accusalCount == 0) {
            return;
        }


        address[] memory archaeologistAddresses = s.sarcophagi[sarcoId].archaeologists;

        // the sarcophagus is compromised if k or more archaeologists have been accused successfully on this call
        bool isSarcophagusCompromised = accusalCount >= sarco.minShards;

        // if the current call hasn't resulted in at least k archaeologists being accused
        // check if total number of accusals on sarcophagus is greater than k
        uint historicalAccusals = 0;
        if (!isSarcophagusCompromised) {
            for (uint256 i = 0; i < archaeologistAddresses.length; i++) {
                if (s.sarcophagusArchaeologists[sarcoId][archaeologistAddresses[i]].accused) {
                    historicalAccusals++;
                }
            }
            // the sarcophagus is compromised if k or more archaeologists have been accused over the lifetime of the sarcophagus
            if (historicalAccusals >= sarco.minShards) {
                isSarcophagusCompromised = true;
            }
        }

        // if k or more archaeologists have been accused over the lifetime of the sarcophagus, funds should
        // be returned to the remaining well behaved archaeologists
        if (isSarcophagusCompromised) {
            // update the sarcophagus state to Accused, the outer key is compromised
            sarco.state = LibTypes.SarcophagusState.Accused;

            // iterate through all archaeologist addresses on the sarcophagus
            for (uint256 i = 0; i < archaeologistAddresses.length; i++) {
                // if the archaeologist has never been accused, release their locked bond back to them
                if (!s.sarcophagusArchaeologists[sarcoId][archaeologistAddresses[i]].accused) {
                    // todo: should digging fees be returned to the embalmer for freed archaeologists?
                     LibBonds.freeArchaeologist(sarcoId, archaeologistAddresses[i]);
                }
            }
        }

        // refund the diggingFees allocated by the embalmer to the accused archaeologists
        // split the total bond being slashed between the embalmer and the payment address
        (
            uint256 accuserBondReward,
            uint256 embalmerBondReward
        ) = _distributeLoot(
                paymentAddress,
                sarco,
                totalDiggingFees,
                totalDiggingFees
            );


        emit AccuseArchaeologist(
            sarcoId,
            msg.sender,
            accuserBondReward,
            embalmerBondReward
        );
    }

    /**
     * @notice Takes a sarcophagus's cursed bond, splits it in half, and sends
     * to paymentAddress and embalmer
     * @param paymentAddress payment address for the transaction caller
     * @param sarc the sarcophagus to operate on
     * @param totalCursedBond the sum of cursed bonds of all archs that failed to fulfil their duties
     * @param totalDiggingFee the sum of digging fees of all archs that failed to fulfil their duties
     * @return halfToSender the amount of SARCO token going to transaction
     * sender
     * @return halfToEmbalmer the amount of SARCO token going to embalmer
     */
    function _distributeLoot(
        address paymentAddress,
        LibTypes.Sarcophagus storage sarc,
        uint256 totalCursedBond,
        uint256 totalDiggingFee
    ) private returns (uint256, uint256) {
        // split the sarcophagus's cursed bond into two halves
        uint256 halfToEmbalmer = totalCursedBond / 2;
        uint256 halfToSender = totalCursedBond - halfToEmbalmer;

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
