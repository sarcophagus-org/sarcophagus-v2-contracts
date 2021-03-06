// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "../libraries/LibTypes.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract ViewStateFacet {
    AppStorage internal s;

    /// @notice Gets the total protocol fees from the contract.
    /// @return The total protocol fees
    function getTotalProtocolFees() external view returns (uint256) {
        return s.totalProtocolFees;
    }

    /// @notice Get the protocol fee amount from the contract.
    /// @return The protocol fee amount
    function getProtocolFeeAmount() external view returns (uint256) {
        return s.protocolFee;
    }

    /// @notice Returns the amount of free bond stored in the contract for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// free bond is being returned
    function getFreeBond(address archaeologist)
        external
        view
        returns (uint256)
    {
        return s.freeBonds[archaeologist];
    }

    /// @notice Returns the amount of rewards stored in the contract for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// reward is being returned
    function getAvailableRewards(address archaeologist)
        external
        view
        returns (uint256)
    {
        return s.archaeologistRewards[archaeologist];
    }

    /// @notice Returns the amount of cursed bond stored in the contract for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// cursed bond is being returned
    function getCursedBond(address archaeologist)
        external
        view
        returns (uint256)
    {
        return s.cursedBonds[archaeologist];
    }

    function getArchaeologistSuccessOnSarcophagus(
        address archaeologist,
        bytes32 sarcoId
    ) external view returns (bool) {
        return s.archaeologistSuccesses[archaeologist][sarcoId];
    }

    /// @notice Returns the number of accusations for an archaeologist.
    /// @param archaeologist The address of the archaeologist whose accusations
    /// are being returned
    function getArchaeologistAccusals(address archaeologist)
        external
        view
        returns (bytes32[] memory)
    {
        return s.archaeologistAccusals[archaeologist];
    }

    /// @notice Returns the number of cleanups for an archaeologist.
    /// @param archaeologist The address of the archaeologist whose cleanups
    /// are being returned
    function getArchaeologistCleanups(address archaeologist)
        external
        view
        returns (bytes32[] memory)
    {
        return s.archaeologistCleanups[archaeologist];
    }

    /// @notice Returns a sarcophagus.
    /// @param sarcoId The identifier of the sarcophagus being returned
    function getSarcophagus(bytes32 sarcoId)
        external
        view
        returns (LibTypes.Sarcophagus memory)
    {
        return s.sarcophagi[sarcoId];
    }

    /// @notice Given an embalmer's address, returns the identifiers of all
    /// sarcophagi that the embalmer has created.
    /// @param embalmer The address of the embalmer whose sarcophagi are being
    /// returned
    function getEmbalmersarcophagi(address embalmer)
        external
        view
        returns (bytes32[] memory)
    {
        return s.embalmerSarcophagi[embalmer];
    }

    /// @notice Given an archaeologist's address, returns the identifiers of all
    /// sarcophagi that the archaeologist has participated in.
    /// @param archaeologist The address of the archaeologist whose sarcophagi
    /// are being returned
    function getArchaeologistsarcophagi(address archaeologist)
        external
        view
        returns (bytes32[] memory)
    {
        return s.archaeologistSarcophagi[archaeologist];
    }

    /// @notice Given a recipient's address, returns the identifiers of all
    /// sarcophagi that the recipient has participated in.
    /// @param recipient The address of the recipient whose sarcophagi are being
    /// returned
    function getRecipientsarcophagi(address recipient)
        external
        view
        returns (bytes32[] memory)
    {
        return s.recipientSarcophagi[recipient];
    }

    /// @notice Returns the data stored on a sarcophagus for an archaeologist.
    /// @param sarcoId The identifier of the sarcophagus whose data is being
    /// returned
    /// @param archaeologist The address of the archaeologist whose data is
    /// being returned
    function getSarcophagusArchaeologist(bytes32 sarcoId, address archaeologist)
        external
        view
        returns (LibTypes.ArchaeologistStorage memory)
    {
        return s.sarcophagusArchaeologists[sarcoId][archaeologist];
    }
}
