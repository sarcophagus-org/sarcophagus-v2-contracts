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

                uint256 cursedBond = LibBonds.calculateCursedBond(
                    defaulter.diggingFee
                );

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
     * @notice Accuse archaeologoists of bad behaviour, by providing proof of leaked
     * unencrypted shards before a sarcophagus is ready to be unwrapped. The minumum
     * number of shards required to unwrap the sarcophagus should be provided for a
     * a successful accusal.
     * of the cursed bonds of the archs back to them, and un-curses their bonds.
     * @param sarcoId The identifier of the sarcophagus having leaked shards
     * @param unencryptedShardHashes At least 'm' unencrypted shard hashes as proof of bad behaviour
     * @param paymentAddress the address to which rewards should be sent if successful
     */
    function accuse(
        bytes32 sarcoId,
        bytes32[] memory unencryptedShardHashes,
        address paymentAddress
    ) external {
        LibUtils.revertIfNotExistOrInactive(sarcoId);

        LibTypes.Sarcophagus storage sarco = s.sarcophagi[sarcoId];

        if (sarco.resurrectionTime < block.timestamp) {
            revert LibErrors.SarcophagusIsUnwrappable();
        }

        if (unencryptedShardHashes.length < sarco.minShards) {
            revert LibErrors.AccuseNotEnoughProof(
                unencryptedShardHashes.length,
                sarco.minShards
            );
        }

        address[] memory accusedArchAddresses = new address[](
            unencryptedShardHashes.length
        );

        // For each provided shard hash, check if its hash matches one on storage. If so, flag that
        // archaeologist as accusable
        uint256 diggingFeesToBeDistributed = 0;
        uint256 totalCursedBond = 0;
        uint256 pos = 0;
        for (uint256 i = 0; i < unencryptedShardHashes.length; i++) {
            bytes32 shardDoubleHash = keccak256(
                abi.encode(unencryptedShardHashes[i])
            );

            address matchingArchAddr = s.doubleHashedShardArchaeologists[
                shardDoubleHash
            ];

            LibTypes.ArchaeologistStorage storage badArch = s
                .sarcophagusArchaeologists[sarcoId][matchingArchAddr];

            if (badArch.unencryptedShardDoubleHash == shardDoubleHash) {
                accusedArchAddresses[pos++] = matchingArchAddr;

                uint256 cursedBond = LibBonds.calculateCursedBond(
                    badArch.diggingFee
                );

                diggingFeesToBeDistributed += badArch.diggingFee;
                totalCursedBond += cursedBond;

                LibBonds.decreaseCursedBond(matchingArchAddr, cursedBond);

                // Save the accusal against the archaeologist
                s.archaeologistAccusals[matchingArchAddr].push(sarcoId);
            } else {
                revert LibErrors.AccuseIncorrectProof();
            }
        }

        // At this point, we need to filter out unaccused archs in order to reimburse them.
        address[] memory bondedArchaeologists = s
            .sarcophagi[sarcoId]
            .archaeologists;

        for (uint256 i = 0; i < bondedArchaeologists.length; i++) {
            // Need to check each archaeologist address on the sarcophagus
            bool isUnaccused = true;

            for (uint256 j = 0; j < accusedArchAddresses.length; j++) {
                // For each arch address, if found in accusedArchAddresses,
                // then don't add to unaccusedArchsAddresses
                if (bondedArchaeologists[i] == accusedArchAddresses[j]) {
                    isUnaccused = false;
                    break;
                }
            }

            // If this arch address wasn't in the accused list, free it from its curse
            if (isUnaccused) {
                // There are technically no rewards here, since the sarcophagus
                // has been compromised, so here this effectively merely resets
                // the state of the non-malicious archaeologists, as if they never
                // bonded to this sarcophagus in the first place.
                //
                // Of course, whatever rewards they might have gained in previous
                // rewraps remains theirs.
                LibBonds.freeArchaeologist(sarcoId, bondedArchaeologists[i]);
            }
        }

        (
            uint256 accuserBondReward,
            uint256 embalmerBondReward
        ) = _distributeLoot(
                paymentAddress,
                sarco,
                totalCursedBond,
                diggingFeesToBeDistributed
            );

        sarco.state = LibTypes.SarcophagusState.Accused;

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
