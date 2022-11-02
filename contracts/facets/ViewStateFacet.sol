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

    /// @notice Gets signatory profiles given a list of signatory addresses.
    /// If an invalid address is included, simply leaves it out of the list.
    /// @param addresses The list of signatory addresses
    /// @return The list of signatory profiles
    function getSignatoryProfiles(address[] memory addresses)
        external
        view
        returns (LibTypes.SignatoryProfile[] memory)
    {
        LibTypes.SignatoryProfile[]
            memory profiles = new LibTypes.SignatoryProfile[](
                addresses.length
            );

        for (uint256 i = 0; i < addresses.length; i++) {
            // Check that the signatory profile exists
            if (!s.signatoryProfiles[addresses[i]].exists) {
                continue;
            }
            profiles[i] = s.signatoryProfiles[addresses[i]];
        }

        return profiles;
    }

    /// @notice Gets the grace period an signatory is given to resurrect a vault after the resurrection time passes
    /// @return The resurrection grace period
    function getGracePeriod() external view returns (uint256) {
        return s.gracePeriod;
    }

    /// @notice Gets the expiration threshold after which a vault must be renegotiated
    /// @return The expiration threshold
    function getExpirationThreshold() external view returns (uint256) {
        return s.expirationThreshold;
    }

    /// @notice Given an signatory address, return that signatory's
    /// profile
    /// @param signatory The signatory account's address
    /// @return the Signatory object
    function getSignatoryProfile(address signatory)
        external
        view
        returns (LibTypes.SignatoryProfile memory)
    {
        return s.signatoryProfiles[signatory];
    }

    /// @notice Return the list of registereed signatory addresses.
    /// @return addresses of registered signatories
    function getSignatoryProfileAddresses()
        external
        view
        returns (address[] memory)
    {
        return s.signatoryProfileAddresses;
    }

    /// @notice Given an index (of the full signatory array), return the
    /// signatory address at that index
    /// @param index The index of the registered signatory
    /// @return address of the signatory
    function getSignatoryProfileAddressAtIndex(uint256 index)
        external
        view
        returns (address)
    {
        return s.signatoryProfileAddresses[index];
    }

    /// @notice Returns the amount of free bond stored in the contract for an
    /// signatory.
    /// @param signatory The address of the signatory whose
    /// free bond is being returned
    function getFreeBond(address signatory)
        external
        view
        returns (uint256)
    {
        return s.signatoryProfiles[signatory].freeBond;
    }

    /// @notice Returns the amount of rewards stored in the contract for an
    /// signatory.
    /// @param signatory The address of the signatory whose
    /// reward is being returned
    function getRewards(address signatory) external view returns (uint256) {
        return s.signatoryRewards[signatory];
    }

    /// @notice Returns the amount of cursed bond stored in the contract for an
    /// signatory.
    /// @param signatory The address of the signatory whose
    /// cursed bond is being returned
    function getCursedBond(address signatory)
        external
        view
        returns (uint256)
    {
        return s.signatoryProfiles[signatory].cursedBond;
    }

    /// @notice Returns whether an signatory completed an unwrap for a vault
    /// @param signatory The address of the signatory
    /// @param vaultId the vault to check if unwrapping occured
    function getSignatorySuccessOnVault(
        address signatory,
        bytes32 vaultId
    ) external view returns (bool) {
        return s.signatoryVaultSuccesses[signatory][vaultId];
    }

    /// @notice Returns the number of successful unwraps for an signatory.
    /// @param signatory The address of the signatory whose success
    //  count is being returned
    function getSignatorySuccessesCount(address signatory)
        external
        view
        returns (uint256)
    {
        return s.signatorySuccesses[signatory].length;
    }

    /// @notice Returns the vault unique identifier for a given
    /// signatory and index of the successfully unwrapped vaults
    /// @param signatory The address of an signatory
    /// @param index The index of the signatory's unwrapped vaults
    /// @return the identifier associated with the index of the signatory's
    /// unwrapped vaults
    function signatorySuccessesIdentifier(
        address signatory,
        uint256 index
    )
        external
        view
        returns (bytes32)
    {
        return s.signatorySuccesses[signatory][index];
    }

    /// @notice Returns the number of accusations for an signatory.
    /// @param signatory The address of the signatory whose accusations
    /// count is being returned
    function getSignatoryAccusalsCount(address signatory)
        external
        view
        returns (uint256)
    {
        return s.signatoryAccusals[signatory].length;
    }

    /// @notice Returns the vault unique identifier for a given
    /// signatory and index of the accused vaults
    /// @param signatory The address of an signatory
    /// @param index The index of the signatory's accused vaults
    /// @return the identifier associated with the index of the signatory's
    /// accused vaults
    function signatoryAccusalsIdentifier(
        address signatory,
        uint256 index
    )
        external
        view
        returns (bytes32)
    {
        return s.signatoryAccusals[signatory][index];
    }

    /// @notice Returns the number of cleanups for an signatory.
    /// @param signatory The address of the signatory whose cleanups
    /// count is being returned
    function getSignatoryCleanupsCount(address signatory)
        external
        view
        returns (uint256)
    {
        return s.signatoryCleanups[signatory].length;
    }

    /// @notice Returns the vault unique identifier for a given
    /// signatory and index of the leaned-up vaults
    /// @param signatory The address of an signatory
    /// @param index The index of the signatory's leaned-up vaults
    /// @return the identifier associated with the index of the signatory's
    /// cleaned-up vaults
    function signatoryCleanupsIdentifier(
        address signatory,
        uint256 index
    )
        external
        view
        returns (bytes32)
    {
        return s.signatoryCleanups[signatory][index];
    }

    /// @notice Gets all reputation statistics for each signatory
    /// Contains a list of counts for each category.
    /// @param addresses The list of signatory addresses
    /// @return The list of signatory statistics
    function getSignatoriesStatistics(address[] memory addresses)
        external
        view
        returns (LibTypes.SignatoryStatistics[] memory)
    {
        LibTypes.SignatoryStatistics[]
        memory statsList = new LibTypes.SignatoryStatistics[](
            addresses.length
        );

        for (uint256 i = 0; i < addresses.length; i++) {
            statsList[i] = LibTypes.SignatoryStatistics(
                this.getSignatorySuccessesCount(addresses[i]),
                this.getSignatoryAccusalsCount(addresses[i]),
                this.getSignatoryCleanupsCount(addresses[i])
            );
        }

        return statsList;
    }

    /// @notice Returns a vault.
    /// @param vaultId The identifier of the vault being returned
    function getVault(bytes32 vaultId)
        external
        view
        returns (LibTypes.Vault memory)
    {
        return s.vaults[vaultId];
    }

    /// @notice Given an vaultOwner's address, returns the identifiers of all
    /// vaults that the vaultOwner has created.
    /// @param vaultOwner The address of the vaultOwner whose vaults are being
    /// returned
    function getEmbalmerVaults(address vaultOwner)
        external
        view
        returns (bytes32[] memory)
    {
        return s.vaultOwnerVaults[vaultOwner];
    }

    /// @notice Given an signatory's address, returns the identifiers of all
    /// vaults that the signatory has participated in.
    /// @param signatory The address of the signatory whose vaults
    /// are being returned
    function getSignatoryVaults(address signatory)
        external
        view
        returns (bytes32[] memory)
    {
        return s.signatoryVaults[signatory];
    }

    /// @notice Given a recipient's address, returns the identifiers of all
    /// vaults that the recipient has participated in.
    /// @param recipient The address of the recipient whose vaults are being
    /// returned
    function getRecipientVaults(address recipient)
        external
        view
        returns (bytes32[] memory)
    {
        return s.recipientVaults[recipient];
    }

    /// @notice Returns the data stored on a vault for an signatory.
    /// @param vaultId The identifier of the vault whose data is being
    /// returned
    /// @param signatory The address of the signatory whose data is
    /// being returned
    function getVaultSignatory(bytes32 vaultId, address signatory)
        external
        view
        returns (LibTypes.SignatoryStorage memory)
    {
        return s.vaultSignatories[vaultId][signatory];
    }
}
