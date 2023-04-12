// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import "../storage/LibAppStorage.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "./LibErrors.sol";

import "../facets/EmbalmerFacet.sol";

library LibBonds {
    /// @notice Decreases the amount stored in the freeBond mapping for an
    /// archaeologist. Reverts if the archaeologist's free bond is lower than
    /// the amount.
    /// @param archaeologist The address of the archaeologist whose
    /// free bond is being decreased
    /// @param amount The amount to decrease the free bond by
    function decreaseFreeBond(address archaeologist, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Revert if the amount is greater than the current free bond
        if (amount > s.archaeologistProfiles[archaeologist].freeBond) {
            revert LibErrors.NotEnoughFreeBond(
                s.archaeologistProfiles[archaeologist].freeBond,
                amount
            );
        }

        // Decrease the free bond amount
        s.archaeologistProfiles[archaeologist].freeBond -= amount;
    }

    /// @notice Decreases the amount stored in the cursedBond mapping for an
    /// archaeologist, without respectively increasing their free bond.
    /// @param archaeologist The address of the archaeologist
    /// @param amount The amount to slash
    function decreaseCursedBond(address archaeologist, uint256 amount) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();

        // Revert if the amount is greater than the current cursed bond
        if (amount > s.archaeologistProfiles[archaeologist].cursedBond) {
            revert LibErrors.NotEnoughCursedBond(
                s.archaeologistProfiles[archaeologist].cursedBond,
                amount
            );
        }

        s.archaeologistProfiles[archaeologist].cursedBond -= amount;
    }

    /// @notice Bonds the archaeologist to a sarcophagus.
    /// This does the following:
    ///   - adds the archaeologist's curse params and address to the sarcophagus
    ///   - calculates digging fees to be locked and later paid to archaeologist (includes curseFee)
    ///   - locks this amount from archaeologist's free bond; increases cursedBond by same
    ///   - Adds the sarcophagus' id to the archaeologist's record of bonded sarcophagi
    /// @param sarcoId Id of the sarcophagus with which to curse the archaeologist
    /// @param archaeologist The archaeologist to curse, with associated parameters of the curse
    ///
    /// @return the amount of digging fees due the embalmer for this curse
    function curseArchaeologist(
        bytes32 sarcoId,
        EmbalmerFacet.CurseParams calldata archaeologist,
        uint256 index
    ) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];

        sarcophagus.cursedArchaeologists[archaeologist.archAddress] = LibTypes.CursedArchaeologist({
            publicKey: archaeologist.publicKey,
            privateKey: 0,
            isAccused: false,
            diggingFeePerSecond: archaeologist.diggingFeePerSecond,
            curseFee: archaeologist.curseFee
        });
        sarcophagus.cursedArchaeologistAddresses[index] = archaeologist.archAddress;

        // Calculate digging fees due for this time period (creationTime/previousRewrapTime -> resurrectionTime)
        uint256 diggingFeesDue = (archaeologist.diggingFeePerSecond *
            (sarcophagus.resurrectionTime - sarcophagus.previousRewrapTime))
            + archaeologist.curseFee;

        // Use cursed bond percentage to determine how much bond to lock up
        uint256 bondToCurse = (((diggingFeesDue) * s.cursedBondPercentage) / 100);

        // Transfer bond to curse from free bond to cursed bond
        decreaseFreeBond(archaeologist.archAddress, bondToCurse);
        s.archaeologistProfiles[archaeologist.archAddress].cursedBond += bondToCurse;

        s.archaeologistSarcophagi[archaeologist.archAddress].push(sarcoId);

        return diggingFeesDue;
    }

    /// @notice Calculates and unlocks an archaeologist's cursed bond. Pays due digging fees to the archaeologist.
    /// @param sarcoId the identifier of the sarcophagus to free the archaeologist from
    /// @param archaeologistAddress the address of the archaeologist to free
    function freeArchaeologist(bytes32 sarcoId, address archaeologistAddress) internal {
        AppStorage storage s = LibAppStorage.getAppStorage();
        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];

        LibTypes.CursedArchaeologist storage cursedArchaeologist = s
            .sarcophagi[sarcoId]
            .cursedArchaeologists[archaeologistAddress];

        // Calculate the digging fees to be paid since the last rewrap (or creation)
        uint256 diggingFeeAmount = cursedArchaeologist.diggingFeePerSecond *
            (sarcophagus.resurrectionTime - sarcophagus.previousRewrapTime);

        // If sarcophagus has not be been rewrapped yet, pay out the curseFee
        if (!sarcophagus.isRewrapped) {
            diggingFeeAmount += cursedArchaeologist.curseFee;
        }

        uint256 cursedBondAmount = (diggingFeeAmount * sarcophagus.cursedBondPercentage) / 100;

        LibBonds.decreaseCursedBond(archaeologistAddress, cursedBondAmount);
        s.archaeologistProfiles[archaeologistAddress].freeBond += cursedBondAmount;

        s.archaeologistRewards[archaeologistAddress] += diggingFeeAmount;
    }
}
