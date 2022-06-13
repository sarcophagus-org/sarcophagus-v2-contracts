// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import "../libraries/LibEvents.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract EmbalmerFacet {
    AppStorage internal s;

    /// @notice Embalmer creates the skeleton for a new sarcopahgus.
    /// @param name the name of the sarcophagus
    /// @param archaeologists the data for the archaeologists
    /// @param arweaveArchaeologist The address of the archaeologist who uploads to arweave
    /// @param recipient the address of the recipient
    /// @param resurrectionTime the resurrection time of the sarcophagus
    /// @param identifier the identifier of the sarcophagus
    /// @param sarcoToken The erc20 sarcophagus token
    /// @param canBeTransferred Whether the sarcophagus can be transferred
    /// @return The index of the new sarcophagus
    function initializeSarcophagus(
        string memory name,
        LibTypes.Archaeologist[] memory archaeologists,
        address arweaveArchaeologist,
        address recipient,
        uint256 resurrectionTime,
        bytes32 identifier,
        IERC20 sarcoToken,
        bool canBeTransferred
    ) external returns (uint256) {
        // Confirm that this exact sarcophagus does not already exist
        require(
            !s.sarcophaguses[identifier].exists,
            "sarcophagus already exists"
        );

        // Confirm that the ressurection time is in the future
        require(
            resurrectionTime > block.timestamp,
            "resurrection time must be in the future"
        );

        // Initialize a list of archaeologist addresses
        address[] memory archaeologistAddresses = new address[](
            archaeologists.length
        );

        for (uint256 i = 0; i < archaeologists.length; i++) {
            // Calculate the amount of cursed bond the archaeologists needs to lock up
            uint256 cursedBondAmount = LibBonds.calculateCursedBond(
                archaeologists[i].diggingFee,
                archaeologists[i].bounty
            );

            // Confirm that the archaeologist has enough free bond.
            // This error could mean that the archaeologist has either run out
            // of free bond or has never even interacted with sarcophagus
            require(
                s.freeBonds[archaeologists[i].archAddress] >= cursedBondAmount,
                "archaeologist does not have enough free bond"
            );

            // Lock up the archaeologist's bond by the cursed bond amount
            LibBonds.lockUpBond(
                archaeologists[i].archAddress,
                cursedBondAmount
            );

            // Add to the neccessary data structures
            s.archaeologistSarcophaguses[archaeologists[i].archAddress].push(
                identifier
            );
            s.sarcophagusArchaeologists[identifier][
                archaeologists[i].archAddress
            ] = archaeologists[i];

            // Add the archaeologist address to the list of addresses to be
            // passed in to the sarcophagus object
            archaeologistAddresses[i] = archaeologists[i].archAddress;
        }

        s.sarcophaguses[identifier] = LibTypes.Sarcophagus({
            name: name,
            exists: true,
            canBeTransferred: canBeTransferred,
            resurrectionTime: resurrectionTime,
            arweaveTxId: "",
            embalmer: msg.sender,
            recipientAddress: recipient,
            arweaveArchaeologist: arweaveArchaeologist,
            archaeologists: archaeologistAddresses
        });

        // Add the identifier to necessary data structures
        s.sarcophagusIdentifiers.push(identifier);
        s.embalmerSarcophaguses[msg.sender].push(identifier);
        s.recipientSarcophaguses[recipient].push(identifier);

        // Calculate the total fees in sarco tokens that the contract will
        // receive from the embalmer
        uint256 totalFees = LibBonds.calculateTotalFees(
            archaeologists,
            s
            .sarcophagusArchaeologists[identifier][arweaveArchaeologist]
                .storageFee
        );

        // Transfer the total fees amount in sarco token from the msg.sender to this contract
        sarcoToken.transferFrom(msg.sender, address(this), totalFees);

        // Emit the event
        emit LibEvents.InitializeSarcophagus(
            identifier,
            name,
            canBeTransferred,
            resurrectionTime,
            msg.sender,
            recipient,
            arweaveArchaeologist,
            archaeologistAddresses
        );

        // Return the index of the sarcophagus
        return s.sarcophagusIdentifiers.length - 1;
    }
}
