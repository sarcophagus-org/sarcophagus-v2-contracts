// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract ArchaeologistFacet {
    AppStorage internal s;

    event UnwrapSarcophagus(bytes32 indexed sarcoId, bytes unencryptedShard);

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

    event WithdrawFreeBond(
        address indexed archaeologist,
        uint256 withdrawnBond
    );

    event WithdrawReward(
        address indexed archaeologist,
        uint256 withdrawnReward
    );

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
        LibTypes.ArchaeologistProfile memory newArch = LibTypes
            .ArchaeologistProfile({
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
        LibTypes.ArchaeologistProfile storage existingArch = s
            .archaeologistProfiles[msg.sender];
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

    /// @notice Unwraps the sarcophagus.
    /// @dev Verifies that the unencrypted shard matches the hashedShard stored
    /// on chain and pays the archaeologist.
    /// @param sarcoId The identifier of the sarcophagus to unwrap
    /// @param unencryptedShard The archaeologist's corresponding unencrypted shard
    function unwrapSarcophagus(bytes32 sarcoId, bytes memory unencryptedShard)
        external
    {
        LibUtils.revertIfNotExistOrInactive(sarcoId);

        // Confirm that the archaeologist has not already unwrapped by checking
        // if the unencryptedShard is empty
        LibUtils.archaeologistUnwrappedCheck(sarcoId, msg.sender);

        // Confirm that the sender is an archaeologist on this sarcophagus
        if (!LibUtils.archaeologistExistsOnSarc(sarcoId, msg.sender)) {
            revert LibErrors.ArchaeologistNotOnSarcophagus(msg.sender);
        }

        // Confirm that the resurrection time has passed and that the
        // grace period has not passed
        LibUtils.unwrapTime(s.sarcophagi[sarcoId].resurrectionTime);

        // Get the archaeologist's data from storage
        LibTypes.ArchaeologistStorage memory archaeologistData = LibUtils
            .getArchaeologist(sarcoId, msg.sender);

        // Confirm that the double hash of the unencrypted shard matches the hashedShard in storage
        bytes32 doubleHash = keccak256(abi.encode(keccak256(unencryptedShard)));
        if (doubleHash != archaeologistData.unencryptedShardDoubleHash) {
            revert LibErrors.UnencryptedShardHashMismatch(
                unencryptedShard,
                archaeologistData.unencryptedShardDoubleHash
            );
        }

        // Store the unencrypted shard in on the archaeologist object in the sarcophagus
        s
        .sarcophagusArchaeologists[sarcoId][msg.sender]
            .unencryptedShard = unencryptedShard;

        // Free the archaeologist's cursed bond
        LibBonds.freeArchaeologist(sarcoId, msg.sender);

        // Save the successful sarcophagus against the archaeologist
        s.archaeologistSarcoSuccesses[msg.sender][sarcoId] = true;
        s.archaeologistSuccesses[msg.sender].push(sarcoId);

        // Transfer the digging fee to the archaeologist's reward pool
        s.archaeologistRewards[msg.sender] += archaeologistData.diggingFee;

        // Emit an event
        emit UnwrapSarcophagus(sarcoId, unencryptedShard);
    }
}
