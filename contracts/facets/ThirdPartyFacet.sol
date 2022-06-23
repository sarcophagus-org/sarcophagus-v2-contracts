// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import "../libraries/LibEvents.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract ThirdPartyFacet {
    AppStorage internal s;

    event AccuseArchaeologist(
        bytes32 indexed identifier,
        address indexed accuser,
        uint256 accuserBondReward,
        uint256 embalmerBondReward
    );

    event CleanUpSarcophagus(
        bytes32 indexed identifier,
        address indexed cleaner,
        uint256 cleanerBondReward,
        uint256 embalmerBondReward
    );

    /// @notice Close a sarcophagus that has not been unwrapped before its resurrection window is passed
    /// @param identifier The sarcophagus ID
    /// @param paymentAddress The address to which rewards will be sent
    function clean(bytes32 identifier, address paymentAddress) external {
        LibTypes.Sarcophagus storage sarco = s.sarcophaguses[identifier];

        if (sarco.state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(identifier);
        }

        // Make sure the sarco is cleanable
        if (
            block.timestamp <
            LibUtils.getGracePeriod(sarco.resurrectionTime) +
                sarco.resurrectionTime
        ) {
            revert LibErrors.SarcophagusNotCleanable();
        }

        // Figure out which archaeoligists did not fulfil their duties;
        // accumulate their digging fees and bounties
        address[] memory archAddresses = sarco.archaeologists;

        uint256 totalCursedBond;
        uint256 totalDiggingFee;
        uint256 totalBounty;

        for (uint256 i = 0; i < archAddresses.length; i++) {
            if (!s.archaeologistSuccesses[archAddresses[i]][identifier]) {
                LibTypes.ArchaeologistStorage memory defaulter = s
                    .sarcophagusArchaeologists[identifier][archAddresses[i]];

                totalBounty += defaulter.bounty;
                totalDiggingFee += defaulter.diggingFee;

                uint256 cursedBond = LibBonds.calculateCursedBond(
                    defaulter.diggingFee,
                    defaulter.bounty
                );

                totalCursedBond += cursedBond;

                // decrease the defaulter's cursed bond
                LibBonds.decreaseCursedBond(archAddresses[i], cursedBond);

                // Save the failure to unwrap against the archaeologist
                s.archaeologistCleanups[archAddresses[i]].push(identifier);
            }
        }

        (
            uint256 cleanerBondReward,
            uint256 embalmerBondReward
        ) = _distributeLoot(
                paymentAddress,
                sarco,
                totalCursedBond,
                totalDiggingFee,
                totalBounty
            );

        sarco.state = LibTypes.SarcophagusState.Done;

        emit CleanUpSarcophagus(
            identifier,
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
     * @param unencryptedShards At least 'm' unencrypted shards as proof of bad behaviour
     * @param paymentAddress the address to which rewards should be sent if successful
     */
    function accuse(
        bytes32 sarcoId,
        bytes[] memory unencryptedShards,
        address paymentAddress
    ) external {
        LibTypes.Sarcophagus storage sarco = s.sarcophaguses[sarcoId];

        if (sarco.state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        if (sarco.resurrectionTime < block.timestamp) {
            revert LibErrors.SarcophagusIsUnwrappable();
        }

        if (unencryptedShards.length < sarco.minShards) {
            revert LibErrors.NotEnoughProof();
        }

        // TODO not in use now, but might be useful for filtering out unaccused archs for reimbursement.
        address[] memory accusedArchAddresses = new address[](
            unencryptedShards.length
        );

        // For each provided shard, check if its hash matches one on storage. If so, flag that
        // archaeologist as accusable
        uint256 diggingFeesToBeDistributed = 0;
        uint256 bountyToBeDistributed = 0;
        uint256 totalCursedBond = 0;
        uint256 pos = 0;
        for (uint256 i = 0; i < unencryptedShards.length; i++) {
            bytes32 shardHash = _hashHelper(unencryptedShards[i]);

            address matchingArchAddr = s.hashedShardArchaeologists[shardHash];

            LibTypes.ArchaeologistStorage storage badArch = s
                .sarcophagusArchaeologists[sarcoId][matchingArchAddr];

            if (badArch.hashedShard == shardHash) {
                accusedArchAddresses[pos++] = matchingArchAddr;

                uint256 cursedBond = LibBonds.calculateCursedBond(
                    badArch.diggingFee,
                    badArch.bounty
                );

                diggingFeesToBeDistributed += badArch.diggingFee;
                bountyToBeDistributed += badArch.bounty;
                totalCursedBond += cursedBond;

                LibBonds.decreaseCursedBond(matchingArchAddr, cursedBond);

                // Save the accusal against the archaeologist
                s.archaeologistAccusals[matchingArchAddr].push(sarcoId);
            } else {
                revert LibErrors.NotEnoughProof();
            }
        }

        (
            uint256 accuserBondReward,
            uint256 embalmerBondReward
        ) = _distributeLoot(
                paymentAddress,
                sarco,
                totalCursedBond,
                diggingFeesToBeDistributed,
                bountyToBeDistributed
            );

        // _reimburseArchs(archs);

        sarco.state = LibTypes.SarcophagusState.Done;

        emit AccuseArchaeologist(
            sarcoId,
            msg.sender,
            accuserBondReward,
            embalmerBondReward
        );
    }

    /**
     * @notice After a sarcophagus has been successfully accused, transfers the value
     * of the cursed bonds of the archs back to them, and un-curses their bonds.
     * @param sarcoId The identifier of the sarcophagus for which the bonds were cursed
     * @param archs The archaeologists to reimburse
     * @param amounts amounts of sarco tokens to transfer to archaeologists. Should be in same order
     * as archs.
     */
    function _reimburseArchs(
        bytes32 sarcoId,
        address[] storage archs,
        uint256[] memory amounts
    ) private {
        for (uint256 i = 0; i < archs.length; i++) {
            s.sarcoToken.transfer(archs[i], amounts[i]); // What account will this transfer from?!
            LibBonds.freeArchaeologist(sarcoId, archs[i]);
        }
    }

    /**
     * @notice Takes a sarcophagus's cursed bond, splits it in half, and sends
     * to paymentAddress and embalmer
     * @param paymentAddress payment address for the transaction caller
     * @param sarc the sarcophagus to operate on
     * @param totalCursedBond the sum of cursed bonds of all archs that failed to fulfil their duties
     * @param totalDiggingFee the sum of digging fees of all archs that failed to fulfil their duties
     * @param totalBounty the sum of bounties that would have been paid to all archs that failed to fulfil their duties
     * @return halfToSender the amount of SARCO token going to transaction
     * sender
     * @return halfToEmbalmer the amount of SARCO token going to embalmer
     */
    function _distributeLoot(
        address paymentAddress,
        LibTypes.Sarcophagus storage sarc,
        uint256 totalCursedBond,
        uint256 totalDiggingFee,
        uint256 totalBounty
    ) private returns (uint256, uint256) {
        // split the sarcophagus's cursed bond into two halves
        uint256 halfToEmbalmer = totalCursedBond / 2;
        uint256 halfToSender = totalCursedBond - halfToEmbalmer;

        // transfer the cursed half, plus bounty, plus digging fee to the
        // embalmer
        s.sarcoToken.transfer(
            sarc.embalmer,
            totalBounty + totalDiggingFee + halfToEmbalmer
        );

        // transfer the other half of the cursed bond to the transaction caller
        s.sarcoToken.transfer(paymentAddress, halfToSender);

        // This cannot be (easily) done here.
        // Instead, it's done as defaulters are being aggregated in clean function
        // LibBonds.decreaseCursedBond(
        //     sarc.archaeologist,
        //     sarc.currentCursedBond
        // );

        return (halfToSender, halfToEmbalmer);
    }

    function _hashHelper(bytes memory data) private pure returns (bytes32) {
        return keccak256(data);
    }
}
