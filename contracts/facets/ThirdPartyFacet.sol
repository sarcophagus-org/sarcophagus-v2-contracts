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

        emit LibEvents.CleanUpSarcophagus(
            identifier,
            msg.sender,
            cleanerBondReward,
            embalmerBondReward
        );
    }

    function accuse(bytes32 sarcoId, bytes[] memory unencryptedShards)
        external
    {
        LibTypes.Sarcophagus storage sarco = s.sarcophaguses[sarcoId];
        if (unencryptedShards.length < sarco.minShards) {
            revert LibErrors.NotEnoughProof();
        }

        address[] memory bondedArchsAddresses = sarco.archaeologists;
        address[] memory accusedArchs = new address[](unencryptedShards.length);

        uint256 pos = 0;
        for (uint256 i = 0; i < unencryptedShards.length; i++) {
            bytes32 shardHash = keccak256(unencryptedShards[i]);

            // Ew
            for (uint256 j = 0; j < bondedArchsAddresses.length; j++) {
                LibTypes.ArchaeologistStorage storage bondedArch = s
                    .sarcophagusArchaeologists[sarcoId][
                        bondedArchsAddresses[j]
                    ];

                if (bondedArch.hashedShard == shardHash) {
                    accusedArchs[pos++] = bondedArchsAddresses[j];
                    continue;
                }

                revert LibErrors.NotEnoughProof();
            }
        }

        emit LibEvents.AccuseArchaeologist(sarcoId, msg.sender, 0, 0);
    }
}