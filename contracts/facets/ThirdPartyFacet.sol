// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "hardhat/console.sol";
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
     * @param sarcoToken the SARCO token used for payment handling
     * @return halfToSender the amount of SARCO token going to transaction
     * sender
     * @return halfToEmbalmer the amount of SARCO token going to embalmer
     */
    function _distributeLoot(
        address paymentAddress,
        LibTypes.Sarcophagus storage sarc,
        uint256 totalCursedBond,
        uint256 totalDiggingFee,
        uint256 totalBounty,
        IERC20 sarcoToken
    ) private returns (uint256, uint256) {
        // split the sarcophagus's cursed bond into two halves
        uint256 halfToEmbalmer = totalCursedBond / 2;
        uint256 halfToSender = totalCursedBond - halfToEmbalmer;

        // transfer the cursed half, plus bounty, plus digging fee to the
        // embalmer
        sarcoToken.transfer(
            sarc.embalmer,
            totalBounty + totalDiggingFee + halfToEmbalmer
        );

        // transfer the other half of the cursed bond to the transaction caller
        sarcoToken.transfer(paymentAddress, halfToSender);

        // This cannot be (easily) done here.
        // Instead, it's done as defaulters are being aggregated in clean function
        // LibBonds.decreaseCursedBond(
        //     sarc.archaeologist,
        //     sarc.currentCursedBond
        // );

        return (halfToSender, halfToEmbalmer);
    }

    // TODO: This loop though...
    function archFailedSarcho(address archaeologist, bytes32 sarcoId) private view returns (bool) {
        for (uint256 i = 0; i < s.archaeologistSuccesses[archaeologist].length; i++) {
            if (s.archaeologistSuccesses[archaeologist][i] == sarcoId) {
                return true;
            }
        }

        return false;
    }

    /// @notice Close a sarcophagus that has not been unwrapped before its resurrection window is passed
    /// @param identifier The sarcophagus ID
    /// @param paymentAddress The address to which rewards will be sent
    function clean(
        bytes32 identifier,
        address paymentAddress,
        IERC20 sarcoToken
    ) external {
        LibTypes.Sarcophagus storage sarco = s.sarcophaguses[identifier];

        // Make sure the sarco is cleanable
        if (block.timestamp < LibUtils.getGracePeriod(sarco.resurrectionTime) + sarco.resurrectionTime) {
            revert LibErrors.SarcophagusNotCleanable();
        }
        

        // Figure out which archaeoligists did not fulfil their duties;
        // accumulate their digging fees and bounties
        address[] memory archAddresses = sarco.archaeologists;

        uint256 totalCursedBond;
        uint256 totalDiggingFee;
        uint256 totalBounty;

        for (uint256 i = 0; i < archAddresses.length; i++) {
            if (archFailedSarcho(archAddresses[i], identifier)) {
            // if (!s.archaeologistSuccesses2[archAddresses[i]][identifier]) { // potentially a better way? If archaeologistSuccesses2[archAddresses[i]] produced a mapping instead of an array
                LibTypes.Archaeologist memory defaulter = s.sarcophagusArchaeologists[identifier][archAddresses[i]];

                totalBounty += defaulter.bounty;
                totalDiggingFee += defaulter.diggingFee;

                uint256 cursedBond = LibBonds.calculateCursedBond(defaulter.diggingFee, defaulter.bounty);

                totalCursedBond += cursedBond;

                // decrease the defaulter's cursed bond
                LibBonds.decreaseCursedBond(defaulter.archAddress, cursedBond);
            }
        }

        _distributeLoot(paymentAddress, sarco, totalCursedBond,totalDiggingFee,totalBounty, sarcoToken);
    }
}