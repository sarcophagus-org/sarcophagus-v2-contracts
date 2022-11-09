// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "../libraries/LibTypes.sol";
import "hardhat/console.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract ViewStateFacet {
    AppStorage internal s;

    /// @notice Gets the total protocol fees from the contract.
    /// @return The total protocol fees
    function getTotalProtocolFees() external view returns (uint256) {
        return s.totalProtocolFees;
    }

    /// @notice Get the protocol fee base percentage from the contract.
    /// @return The protocol fee base percentage - protocolFeeBasePercentage
    function getProtocolFeeBasePercentage() external view returns (uint256) {
        return s.protocolFeeBasePercentage;
    }

    /// @notice Gets archaeologist profiles given a list of archaeologist addresses.
    /// If an invalid address is included, simply leaves it out of the list.
    /// @param addresses The list of archaeologist addresses
    /// @return The list of archaeologist profiles
    function getArchaeologistProfiles(address[] memory addresses)
        external
        view
        returns (LibTypes.ArchaeologistProfile[] memory)
    {
        LibTypes.ArchaeologistProfile[]
            memory profiles = new LibTypes.ArchaeologistProfile[](
                addresses.length
            );

        for (uint256 i = 0; i < addresses.length; i++) {
            // Check that the archaeologist profile exists
            if (!s.archaeologistProfiles[addresses[i]].exists) {
                continue;
            }
            profiles[i] = s.archaeologistProfiles[addresses[i]];
        }

        return profiles;
    }

    /// @notice Gets the grace period an archaeologist is given to resurrect a sarcophagus after the resurrection time passes
    /// @return The resurrection grace period
    function getGracePeriod() external view returns (uint256) {
        return s.gracePeriod;
    }

    /// @notice Gets the expiration threshold after which a sarcophagus must be renegotiated
    /// @return The expiration threshold
    function getExpirationThreshold() external view returns (uint256) {
        return s.expirationThreshold;
    }

    /// @notice Given an archaeologist address, return that archaeologist's
    /// profile
    /// @param archaeologist The archaeologist account's address
    /// @return the Archaeologist object
    function getArchaeologistProfile(address archaeologist)
        external
        view
        returns (LibTypes.ArchaeologistProfile memory)
    {
        return s.archaeologistProfiles[archaeologist];
    }

    /// @notice Return the list of registereed archaeologist addresses.
    /// @return addresses of registered archaeologists
    function getArchaeologistProfileAddresses()
        external
        view
        returns (address[] memory)
    {
        return s.archaeologistProfileAddresses;
    }

    /// @notice Given an index (of the full archaeologist array), return the
    /// archaeologist address at that index
    /// @param index The index of the registered archaeologist
    /// @return address of the archaeologist
    function getArchaeologistProfileAddressAtIndex(uint256 index)
        external
        view
        returns (address)
    {
        return s.archaeologistProfileAddresses[index];
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
        return s.archaeologistProfiles[archaeologist].freeBond;
    }

    /// @notice Returns the amount of rewards stored in the contract for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// reward is being returned
    function getRewards(address archaeologist) external view returns (uint256) {
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
        return s.archaeologistProfiles[archaeologist].cursedBond;
    }

    /// @notice Returns whether an archaeologist completed an unwrap for a sarcophagus
    /// @param archaeologist The address of the archaeologist
    /// @param sarcoId the sarcophagus to check if unwrapping occured
    function getArchaeologistSuccessOnSarcophagus(
        address archaeologist,
        bytes32 sarcoId
    ) external view returns (bool) {
        return s.archaeologistSarcoSuccesses[archaeologist][sarcoId];
    }

    /// @notice Returns the number of successful unwraps for an archaeologist.
    /// @param archaeologist The address of the archaeologist whose success
    //  count is being returned
    function getArchaeologistSuccessesCount(address archaeologist)
        external
        view
        returns (uint256)
    {
        return s.archaeologistSuccesses[archaeologist].length;
    }

    /// @notice Returns the sarcophagus unique identifier for a given
    /// archaeologist and index of the successfully unwrapped sarcophagi
    /// @param archaeologist The address of an archaeologist
    /// @param index The index of the archaeologist's unwrapped sarcophagi
    /// @return the identifier associated with the index of the archaeologist's
    /// unwrapped sarcophagi
    function archaeologistSuccessesIdentifier(
        address archaeologist,
        uint256 index
    )
        external
        view
        returns (bytes32)
    {
        return s.archaeologistSuccesses[archaeologist][index];
    }

    /// @notice Returns the number of accusations for an archaeologist.
    /// @param archaeologist The address of the archaeologist whose accusations
    /// count is being returned
    function getArchaeologistAccusalsCount(address archaeologist)
        external
        view
        returns (uint256)
    {
        return s.archaeologistAccusals[archaeologist].length;
    }

    /// @notice Returns the sarcophagus unique identifier for a given
    /// archaeologist and index of the accused sarcophagi
    /// @param archaeologist The address of an archaeologist
    /// @param index The index of the archaeologist's accused sarcophagi
    /// @return the identifier associated with the index of the archaeologist's
    /// accused sarcophagi
    function archaeologistAccusalsIdentifier(
        address archaeologist,
        uint256 index
    )
        external
        view
        returns (bytes32)
    {
        return s.archaeologistAccusals[archaeologist][index];
    }

    /// @notice Returns the number of cleanups for an archaeologist.
    /// @param archaeologist The address of the archaeologist whose cleanups
    /// count is being returned
    function getArchaeologistCleanupsCount(address archaeologist)
        external
        view
        returns (uint256)
    {
        return s.archaeologistCleanups[archaeologist].length;
    }

    /// @notice Returns the sarcophagus unique identifier for a given
    /// archaeologist and index of the cleaned-up sarcophagi
    /// @param archaeologist The address of an archaeologist
    /// @param index The index of the archaeologist's cleaned-up sarcophagi
    /// @return the identifier associated with the index of the archaeologist's
    /// cleaned-up sarcophagi
    function archaeologistCleanupsIdentifier(
        address archaeologist,
        uint256 index
    )
        external
        view
        returns (bytes32)
    {
        return s.archaeologistCleanups[archaeologist][index];
    }

    /// @notice Gets all reputation statistics for each archaeologist
    /// Contains a list of counts for each category.
    /// @param addresses The list of archaeologist addresses
    /// @return The list of archaeologist statistics
    function getArchaeologistsStatistics(address[] memory addresses)
        external
        view
        returns (LibTypes.ArchaeologistStatistics[] memory)
    {
        LibTypes.ArchaeologistStatistics[]
        memory statsList = new LibTypes.ArchaeologistStatistics[](
            addresses.length
        );

        for (uint256 i = 0; i < addresses.length; i++) {
            statsList[i] = LibTypes.ArchaeologistStatistics(
                this.getArchaeologistSuccessesCount(addresses[i]),
                this.getArchaeologistAccusalsCount(addresses[i]),
                this.getArchaeologistCleanupsCount(addresses[i])
            );
        }

        return statsList;
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
    function getEmbalmerSarcophagi(address embalmer)
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
    function getArchaeologistSarcophagi(address archaeologist)
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
    function getRecipientSarcophagi(address recipient)
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
