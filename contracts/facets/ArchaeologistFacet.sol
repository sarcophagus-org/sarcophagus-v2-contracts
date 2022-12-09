// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {LibPrivateKeys} from "../libraries/LibPrivateKeys.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract ArchaeologistFacet {
    AppStorage internal s;

    event PublishPrivateKey(bytes32 indexed sarcoId, bytes32 privateKey);

    event DepositFreeBond(address indexed archaeologist, uint256 depositedBond);

    event RegisterArchaeologist(
        address indexed archaeologist,
        string peerId,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    );

    event UpdateArchaeologist(
        address indexed archaeologist,
        string peerId,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    );

    event WithdrawFreeBond(address indexed archaeologist, uint256 withdrawnBond);

    event WithdrawReward(address indexed archaeologist, uint256 withdrawnReward);

    /// @notice Registers the archaeologist profile
    /// @param peerId The libp2p identifier for the archaeologist
    /// @param minimumDiggingFee The archaeologist's minimum amount to accept for a digging fee
    /// @param maximumRewrapInterval The longest interval of time from a rewrap time the arch will accept
    /// for a resurrection
    /// @param freeBond How much bond the archaeologist wants to deposit during the register call (if any)
    function registerArchaeologist(
        string memory peerId,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    ) external {
        // verify that the archaeologist does not already exist
        LibUtils.revertIfArchProfileExists(msg.sender);

        // create a new archaeologist
        LibTypes.ArchaeologistProfile memory newArch = LibTypes.ArchaeologistProfile({
            exists: true,
            peerId: peerId,
            minimumDiggingFee: minimumDiggingFee,
            maximumRewrapInterval: maximumRewrapInterval,
            freeBond: freeBond,
            cursedBond: 0
        });

        // transfer SARCO tokens from the archaeologist to this contract, to be
        // used as their free bond. can be 0.
        if (freeBond > 0) {
            s.sarcoToken.transferFrom(msg.sender, address(this), freeBond);
        }

        // save the new archaeologist into relevant data structures
        s.archaeologistProfiles[msg.sender] = newArch;
        s.archaeologistProfileAddresses.push(msg.sender);

        emit RegisterArchaeologist(
            msg.sender,
            newArch.peerId,
            newArch.minimumDiggingFee,
            newArch.maximumRewrapInterval,
            newArch.freeBond
        );
    }

    /// @notice Updates the archaeologist profile
    /// @param peerId The libp2p identifier for the archaeologist
    /// @param minimumDiggingFee The archaeologist's minimum amount to accept for a digging fee
    /// @param maximumRewrapInterval The longest interval of time from a rewrap time the arch will accept
    /// for a resurrection
    /// freeBond How much bond the archaeologist wants to deposit during the update call (if any)
    function updateArchaeologist(
        string memory peerId,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    ) external {
        // verify that the archaeologist exists
        LibUtils.revertIfArchProfileDoesNotExist(msg.sender);

        // create a new archaeologist
        LibTypes.ArchaeologistProfile storage existingArch = s.archaeologistProfiles[msg.sender];
        existingArch.peerId = peerId;
        existingArch.minimumDiggingFee = minimumDiggingFee;
        existingArch.maximumRewrapInterval = maximumRewrapInterval;

        // transfer SARCO tokens from the archaeologist to this contract, to be
        // used as their free bond. can be 0.
        if (freeBond > 0) {
            LibBonds.increaseFreeBond(msg.sender, freeBond);
            s.sarcoToken.transferFrom(msg.sender, address(this), freeBond);
        }

        emit UpdateArchaeologist(
            msg.sender,
            existingArch.peerId,
            existingArch.minimumDiggingFee,
            existingArch.maximumRewrapInterval,
            existingArch.freeBond
        );
    }

    /// @notice Deposits an archaeologist's free bond to the contract.
    /// @param amount The amount to deposit
    function depositFreeBond(uint256 amount) external {
        LibUtils.revertIfArchProfileDoesNotExist(msg.sender);
        // Increase the archaeologist's free bond in app storage
        LibBonds.increaseFreeBond(msg.sender, amount);

        // Transfer the amount of sarcoToken from the archaeologist to the contract
        s.sarcoToken.transferFrom(msg.sender, address(this), amount);
        // Emit an event
        emit DepositFreeBond(msg.sender, amount);
    }

    /// @notice Withdraws an archaeologist's free bond from the contract.
    /// @param amount The amount to withdraw
    function withdrawFreeBond(uint256 amount) external {
        LibUtils.revertIfArchProfileDoesNotExist(msg.sender);
        // Decrease the archaeologist's free bond amount.
        // Reverts if there is not enough free bond on the contract.
        LibBonds.decreaseFreeBond(msg.sender, amount);

        // Transfer the amount of sarcoToken to the archaeologist
        s.sarcoToken.transfer(msg.sender, amount);

        // Emit an event
        emit WithdrawFreeBond(msg.sender, amount);
    }

    /// @notice Withdraws all rewards from an archaeologist's reward pool
    function withdrawReward() external {
        uint256 amountToWithdraw = s.archaeologistRewards[msg.sender];
        s.archaeologistRewards[msg.sender] = 0;

        // Transfer the amount of sarcoToken to the archaeologist
        s.sarcoToken.transfer(msg.sender, amountToWithdraw);

        emit WithdrawReward(msg.sender, amountToWithdraw);
    }

    /// @notice Publishes the private key for which the archaeologist is responsible during the
    /// sarcophagus resurrection window.
    /// Pays digging fees to the archaeologist and releases their locked bond.
    /// Cannot be called on a compromised or buried sarcophagus.
    /// @param sarcoId The identifier of the sarcophagus to unwrap
    /// @param privateKey The private key the archaeologist is publishing
    function publishPrivateKey(bytes32 sarcoId, bytes32 privateKey) external {
        LibTypes.Sarcophagus storage sarcophagus = s.sarcophagi[sarcoId];

        // Confirm sarcophagus exists
        if (sarcophagus.resurrectionTime == 0) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm sarcophagus has not been compromised
        if (sarcophagus.isCompromised) {
            revert LibErrors.SarcophagusCompromised(sarcoId);
        }

        // Confirm sarcophagus is not buried
        if (sarcophagus.resurrectionTime == 2 ** 256 - 1) {
            revert LibErrors.SarcophagusInactive(sarcoId);
        }

        // Confirm current time is after resurrectionTime
        if (block.timestamp < sarcophagus.resurrectionTime) {
            revert LibErrors.TooEarlyToUnwrap(sarcophagus.resurrectionTime, block.timestamp);
        }

        // Confirm current time is within gracePeriod
        if (block.timestamp > sarcophagus.resurrectionTime + s.gracePeriod) {
            revert LibErrors.TooLateToUnwrap(
                sarcophagus.resurrectionTime,
                s.gracePeriod,
                block.timestamp
            );
        }

        // Confirm tx sender is an archaeologist on the sarcophagus
        LibTypes.CursedArchaeologist storage cursedArchaeologist = s
            .sarcophagi[sarcoId]
            .cursedArchaeologists[msg.sender];
        if (cursedArchaeologist.publicKey.length == 0) {
            revert LibErrors.ArchaeologistNotOnSarcophagus(msg.sender);
        }

        // Confirm archaeologist has not already published key share
        if (cursedArchaeologist.privateKey != 0) {
            revert LibErrors.ArchaeologistAlreadyUnwrapped(msg.sender);
        }

        // Confirm that the private key being submitted matches the public key stored on the
        // sarcophagus for this archaeologist
        if (LibPrivateKeys.keyVerification(privateKey, cursedArchaeologist.publicKey)) {
            revert LibErrors.PrivateKeyDoesNotMatchPublicKey(
                privateKey,
                cursedArchaeologist.publicKey
            );
        }

        // Store the private key on cursed archaeologist
        cursedArchaeologist.privateKey = privateKey;

        // Free archaeologist locked bond and transfer digging fees
        LibBonds.freeArchaeologist(sarcoId, msg.sender);
        s.archaeologistRewards[msg.sender] += cursedArchaeologist.diggingFee;

        // Save the successful sarcophagus against the archaeologist
        s.archaeologistSuccesses[msg.sender].push(sarcoId);

        emit PublishPrivateKey(sarcoId, privateKey);
    }
}
