// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../libraries/LibUtils.sol";
import "../../libraries/LibEvents.sol";
import "../../libraries/LibTypes.sol";
import {LibDiamondStorage} from "../../diamond/libraries/LibDiamondStorage.sol";
import {LibDiamond} from "../../diamond/libraries/LibDiamond.sol";
import {LibArchaeologists} from "./LibArchaeologists.sol";

/// @title The archaeologsts facet
/// @dev This facet/contract contains the external functions for the archaeologists feature
contract ArchaeologistsFacet {
    /**
     * @notice Registers a new archaeologist in the system
     * @param currentPublicKey the public key to be used in the first
     * sarcophagus
     * @param endpoint where to contact this archaeologist on the internet
     * @param paymentAddress all collected payments for the archaeologist will
     * be sent here
     * @param feePerByte amount of SARCO tokens charged per byte of storage
     * being sent to Arweave
     * @param minimumBounty the minimum bounty for a sarcophagus that the
     * archaeologist will accept
     * @param minimumDiggingFee the minimum digging fee for a sarcophagus that
     * the archaeologist will accept
     * @param maximumResurrectionTime the maximum resurrection time for a
     * sarcophagus that the archaeologist will accept, in relative terms (i.e.
     * "1 year" is 31536000 (seconds))
     * @param freeBond the amount of SARCO bond that the archaeologist wants
     * to start with
     * @param sarcoToken the SARCO token used for payment handling
     * @return index of the new archaeologist
     */
    function registerArchaeologist(
        bytes memory currentPublicKey,
        string memory endpoint,
        address paymentAddress,
        uint256 feePerByte,
        uint256 minimumBounty,
        uint256 minimumDiggingFee,
        uint256 maximumResurrectionTime,
        uint256 freeBond,
        IERC20 sarcoToken
    ) external returns (uint256) {
        LibDiamondStorage.DiamondStorage storage ds = LibDiamond
            .diamondStorage();

        // verify that the archaeologist does not already exist
        LibArchaeologists.archaeologistExists(msg.sender, false);

        // verify that the public key length is accurate
        LibUtils.publicKeyLength(currentPublicKey);

        // transfer SARCO tokens from the archaeologist to this contract, to be
        // used as their free bond. can be 0, which indicates that the
        // archaeologist is not eligible for any new jobs
        if (freeBond > 0) {
            sarcoToken.transferFrom(msg.sender, address(this), freeBond);
        }

        // create a new archaeologist
        LibTypes.Archaeologist memory newArch = LibTypes.Archaeologist({
            exists: true,
            currentPublicKey: currentPublicKey,
            endpoint: endpoint,
            paymentAddress: paymentAddress,
            feePerByte: feePerByte,
            minimumBounty: minimumBounty,
            minimumDiggingFee: minimumDiggingFee,
            maximumResurrectionTime: maximumResurrectionTime,
            freeBond: freeBond,
            cursedBond: 0
        });

        // save the new archaeologist into relevant data structures
        ds.archaeologists[msg.sender] = newArch;
        ds.archaeologistAddresses.push(msg.sender);

        // emit an event
        emit LibEvents.RegisterArchaeologist(
            msg.sender,
            newArch.currentPublicKey,
            newArch.endpoint,
            newArch.paymentAddress,
            newArch.feePerByte,
            newArch.minimumBounty,
            newArch.minimumDiggingFee,
            newArch.maximumResurrectionTime,
            newArch.freeBond
        );

        // return index of the new archaeologist
        return ds.archaeologistAddresses.length - 1;
    }

    /**
     * @notice An archaeologist may update their profile
     * @param endpoint where to contact this archaeologist on the internet
     * @param newPublicKey the public key to be used in the next
     * sarcophagus
     * @param paymentAddress all collected payments for the archaeologist will
     * be sent here
     * @param feePerByte amount of SARCO tokens charged per byte of storage
     * being sent to Arweave
     * @param minimumBounty the minimum bounty for a sarcophagus that the
     * archaeologist will accept
     * @param minimumDiggingFee the minimum digging fee for a sarcophagus that
     * the archaeologist will accept
     * @param maximumResurrectionTime the maximum resurrection time for a
     * sarcophagus that the archaeologist will accept, in relative terms (i.e.
     * "1 year" is 31536000 (seconds))
     * @param freeBond the amount of SARCO bond that the archaeologist wants
     * to add to their profile
     * @param sarcoToken the SARCO token used for payment handling
     * @return bool indicating that the update was successful
     */
    function updateArchaeologist(
        bytes memory newPublicKey,
        string memory endpoint,
        address paymentAddress,
        uint256 feePerByte,
        uint256 minimumBounty,
        uint256 minimumDiggingFee,
        uint256 maximumResurrectionTime,
        uint256 freeBond,
        IERC20 sarcoToken
    ) external returns (bool) {
        LibDiamondStorage.DiamondStorage storage ds = LibDiamond
            .diamondStorage();

        // verify that the archaeologist exists, and is the sender of this
        // transaction
        LibArchaeologists.archaeologistExists(msg.sender, true);

        // load up the archaeologist
        LibTypes.Archaeologist storage arch = ds.archaeologists[msg.sender];

        // if archaeologist is updating their active public key, emit an event
        if (keccak256(arch.currentPublicKey) != keccak256(newPublicKey)) {
            emit LibEvents.UpdateArchaeologistPublicKey(
                msg.sender,
                newPublicKey
            );
            arch.currentPublicKey = newPublicKey;
        }

        // update the rest of the archaeologist profile
        arch.endpoint = endpoint;
        arch.paymentAddress = paymentAddress;
        arch.feePerByte = feePerByte;
        arch.minimumBounty = minimumBounty;
        arch.minimumDiggingFee = minimumDiggingFee;
        arch.maximumResurrectionTime = maximumResurrectionTime;

        // the freeBond variable acts as an incrementer, so only if it's above
        // zero will we update their profile variable and transfer the tokens
        if (freeBond > 0) {
            LibArchaeologists.increaseFreeBond(msg.sender, freeBond);
            sarcoToken.transferFrom(msg.sender, address(this), freeBond);
        }

        // emit an event
        emit LibEvents.UpdateArchaeologist(
            msg.sender,
            arch.endpoint,
            arch.paymentAddress,
            arch.feePerByte,
            arch.minimumBounty,
            arch.minimumDiggingFee,
            arch.maximumResurrectionTime,
            freeBond
        );

        // return true
        return true;
    }

    /**
     * @notice Archaeologist can withdraw any of their free bond
     * @param amount the amount of the archaeologist's free bond that they're
     * withdrawing
     * @param sarcoToken the SARCO token used for payment handling
     * @return bool indicating that the withdrawal was successful
     */
    function withdrawBond(uint256 amount, IERC20 sarcoToken)
        external
        returns (bool)
    {
        // verify that the archaeologist exists, and is the sender of this
        // transaction
        LibArchaeologists.archaeologistExists(msg.sender, true);

        // move free bond out of the archaeologist
        LibArchaeologists.decreaseFreeBond(msg.sender, amount);

        // transfer the freed SARCOs back to the archaeologist
        sarcoToken.transfer(msg.sender, amount);

        // emit event
        emit LibEvents.WithdrawalFreeBond(msg.sender, amount);

        // return true
        return true;
    }
}
