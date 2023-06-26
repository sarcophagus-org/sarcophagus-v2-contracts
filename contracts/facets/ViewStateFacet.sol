// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import "../libraries/LibTypes.sol";
import "../libraries/LibUtils.sol";
import "../storage/LibAppStorage.sol";

contract ViewStateFacet {
    /// @notice Get the admin address from diamond storage
    /// @return The admin address
    function getAdmin() external view returns (address) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.admin;
    }

    /// @notice Gets the total protocol fees from diamond storage
    /// @return The total protocol fees
    function getTotalProtocolFees() external view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.totalProtocolFees;
    }

    /// @notice Get the protocol fee base percentage from diamond storage
    /// @return The protocol fee base percentage - protocolFeeBasePercentage
    function getProtocolFeeBasePercentage() external view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.protocolFeeBasePercentage;
    }

    /// @notice Get the cursed bond percentage from diamond storage
    /// @return The cursed bond percentage - cursedBondPercentage
    function getCursedBondPercentage() external view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.cursedBondPercentage;
    }

    /// @notice Gets archaeologist profiles given a list of archaeologist addresses.
    /// If an invalid address is included, simply leaves it out of the list.
    /// @param addresses The list of archaeologist addresses
    /// @return The list of archaeologist profiles
    function getArchaeologistProfiles(
        address[] memory addresses
    ) external view returns (LibTypes.ArchaeologistProfile[] memory) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        uint256 nAddresses = addresses.length;
        LibTypes.ArchaeologistProfile[] memory profiles = new LibTypes.ArchaeologistProfile[](
            nAddresses
        );

        for (uint256 i; i < nAddresses; ) {
            // Skip unregistered archaeologists
            if (s.archaeologistProfiles[addresses[i]].maximumRewrapInterval == 0) {
                continue;
            }
            profiles[i] = s.archaeologistProfiles[addresses[i]];
            unchecked {
                ++i;
            }
        }

        return profiles;
    }

    /// @notice Gets the grace period an archaeologist is given to resurrect a sarcophagus after the resurrection time passes
    /// @return The resurrection grace period
    function getGracePeriod() external view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.gracePeriod;
    }

    /// @notice Gets the window after end of gracePeriod + resurrectionTime where embalmer can claim remaining bonds from archaeologists that have failed to publish private keys
    /// @return The embalmer claim window
    function getEmbalmerClaimWindow() external view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.embalmerClaimWindow;
    }

    /// @notice Gets the expiration threshold after which a sarcophagus must be renegotiated
    /// @return The expiration threshold
    function getExpirationThreshold() external view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.expirationThreshold;
    }

    /// @notice Given an archaeologist address, return that archaeologist's
    /// profile
    /// @param archaeologist The archaeologist account's address
    /// @return the Archaeologist object
    function getArchaeologistProfile(
        address archaeologist
    ) external view returns (LibTypes.ArchaeologistProfile memory) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        LibUtils.revertIfArchProfileDoesNotExist(archaeologist);
        return s.archaeologistProfiles[archaeologist];
    }

    /// @notice Return the list of registereed archaeologist addresses.
    /// @return addresses of registered archaeologists
    function getArchaeologistProfileAddresses() external view returns (address[] memory) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.archaeologistProfileAddresses;
    }

    /// @notice Given an index (of the full archaeologist array), return the
    /// archaeologist address at that index
    /// @param index The index of the registered archaeologist
    /// @return address of the archaeologist
    function getArchaeologistProfileAddressAtIndex(uint256 index) external view returns (address) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.archaeologistProfileAddresses[index];
    }

    /// @notice Returns the amount of free bond stored in the contract for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// free bond is being returned
    function getFreeBond(address archaeologist) external view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.archaeologistProfiles[archaeologist].freeBond;
    }

    /// @notice Returns the amount of rewards stored in the contract for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// reward is being returned
    function getRewards(address archaeologist) external view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.archaeologistRewards[archaeologist];
    }

    /// @notice Returns the amount of cursed bond stored in the contract for an
    /// archaeologist.
    /// @param archaeologist The address of the archaeologist whose
    /// cursed bond is being returned
    function getCursedBond(address archaeologist) external view returns (uint256) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.archaeologistProfiles[archaeologist].cursedBond;
    }

    struct SarcophagusResponse {
        uint256 resurrectionTime;
        uint256 previousRewrapTime;
        bool isCompromised;
        bool isCleaned;
        string name;
        uint8 threshold;
        uint256 maximumRewrapInterval;
        uint256 maximumResurrectionTime;
        uint256 cursedBondPercentage;
        string arweaveTxId;
        address embalmerAddress;
        address recipientAddress;
        address[] archaeologistAddresses;
        uint8 publishedPrivateKeyCount;
        bool hasLockedBond;
    }

    /// @notice Returns data on the sarcophagus with the supplied id
    /// includes aggregate data on cursed archaeologists associated with the sarcophagus
    ///     - publishedPrivateKeyCount - the total number of private keys published by archaeologists on the sarcophagus
    ///     - hasLockedBond - true if archaeologists still have bond locked in the contract for this sarcophagus
    /// @param sarcoId The identifier of the sarcophagus being returned
    function getSarcophagus(bytes32 sarcoId) external view returns (SarcophagusResponse memory) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];

        // Confirm sarcophagus exists
        if (sarcophagus.resurrectionTime == 0) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        uint8 publishedPrivateKeyCount;
        bool hasLockedBond;
        uint256 archsLength = sarcophagus.cursedArchaeologistAddresses.length;
        for (uint256 i; i < archsLength; ) {
            // archaeologist has published a private key
            if (
                sarcophagus
                    .cursedArchaeologists[sarcophagus.cursedArchaeologistAddresses[i]]
                    .privateKey != 0
            ) {
                ++publishedPrivateKeyCount;
            } else if (
                !sarcophagus
                    .cursedArchaeologists[sarcophagus.cursedArchaeologistAddresses[i]]
                    .isAccused &&
                !sarcophagus.isCompromised &&
                !sarcophagus.isCleaned &&
                sarcophagus.resurrectionTime != type(uint256).max
            ) {
                // if the sarcophagus is not compromised, buried, or cleaned and
                // one or more unaccused archaeologists hasn't published a private key there is locked bond on the sarcophagus
                hasLockedBond = true;
            }
            unchecked {
                ++i;
            }
        }

        return
            SarcophagusResponse({
                resurrectionTime: sarcophagus.resurrectionTime,
                previousRewrapTime: sarcophagus.previousRewrapTime,
                isCompromised: sarcophagus.isCompromised,
                isCleaned: sarcophagus.isCleaned,
                name: sarcophagus.name,
                threshold: sarcophagus.threshold,
                maximumRewrapInterval: sarcophagus.maximumRewrapInterval,
                maximumResurrectionTime: sarcophagus.maximumResurrectionTime,
                cursedBondPercentage: sarcophagus.cursedBondPercentage,
                arweaveTxId: sarcophagus.arweaveTxId,
                embalmerAddress: sarcophagus.embalmerAddress,
                recipientAddress: sarcophagus.recipientAddress,
                archaeologistAddresses: sarcophagus.cursedArchaeologistAddresses,
                publishedPrivateKeyCount: publishedPrivateKeyCount,
                hasLockedBond: hasLockedBond
            });
    }

    /// @notice Given an embalmer's address, returns the identifiers of all
    /// sarcophagi that the embalmer has created.
    /// @param embalmer The address of the embalmer whose sarcophagi are being
    /// returned
    function getEmbalmerSarcophagi(address embalmer) external view returns (bytes32[] memory) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.embalmerSarcophagi[embalmer];
    }

    /// @notice Given an archaeologist's address, returns the identifiers of all
    /// sarcophagi that the archaeologist has participated in.
    /// @param archaeologist The address of the archaeologist whose sarcophagi
    /// are being returned
    function getArchaeologistSarcophagi(
        address archaeologist
    ) external view returns (bytes32[] memory) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.archaeologistSarcophagi[archaeologist];
    }

    /// @notice Given a recipient's address, returns the identifiers of all
    /// sarcophagi that the recipient has participated in.
    /// @param recipient The address of the recipient whose sarcophagi are being
    /// returned
    function getRecipientSarcophagi(address recipient) external view returns (bytes32[] memory) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.recipientSarcophagi[recipient];
    }

    /// @notice Returns the data stored on a sarcophagus for an archaeologist.
    /// @param sarcoId The identifier of the sarcophagus whose data is being
    /// returned
    /// @param archaeologist The address of the archaeologist whose data is
    /// being returned
    function getSarcophagusArchaeologist(
        bytes32 sarcoId,
        address archaeologist
    ) external view returns (LibTypes.CursedArchaeologist memory) {
        AppStorage storage s = LibAppStorage.getAppStorage();
        return s.sarcophagi[sarcoId].cursedArchaeologists[archaeologist];
    }
}
