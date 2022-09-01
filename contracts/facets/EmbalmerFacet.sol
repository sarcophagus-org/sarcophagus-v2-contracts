// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibRewards} from "../libraries/LibRewards.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract EmbalmerFacet {
    // IMPORTANT: AppStorage must be the first state variable in the facet.
    AppStorage internal s;

    event InitializeSarcophagus(
        bytes32 indexed sarcoId,
        string name,
        bool canBeTransferred,
        uint256 resurrectionTime,
        address embalmer,
        address recipient,
        address[] cursedArchaeologists,
        uint256 totalFees
    );

    event FinalizeSarcophagus(bytes32 indexed sarcoId, string arweaveTxId);

    event RewrapSarcophagus(bytes32 indexed sarcoId, uint256 resurrectionTime);

    event CancelSarcophagus(bytes32 indexed sarcoId);

    event BurySarcophagus(bytes32 indexed sarcoId);

    // Archaeologist's addresses are added to this mapping per sarcophagus to
    // verify that the same archaeologist signature is not used more than once.
    mapping(bytes32 => mapping(address => bool)) private verifiedArchaeologists;

    /// @notice Embalmer creates the skeleton for a new sarcopahgus.
    ///
    /// InitializeSarcophagus is the first step of the two step mummification
    /// process.
    ///
    /// The purpose of initializeSarcophagus is to:
    ///   - Lock up payment for the archaeologists (digging fees)
    ///   - Store hashes of the unencrypted shards on chain
    ///   - Store the participating archaeologists' addresses and individual
    ///     denominations of fees dedicated to each
    ///   - Create the sarcophagus object
    ///
    /// After initializeSarcophagus the archaeologists have been chosen but may
    /// have no knowledge of the sarcophagus yet. An archaeologist still needs
    /// to upload a payload to arweave and also communicate directly with the
    /// embalmer to indicate that they are ready to do work. After this the
    /// finalizeSarcophagus() method should be called, which is the second step.
    ///
    /// @param sarcoId the identifier of the sarcophagus
    /// @param sarcophagus an object that contains the sarcophagus data
    /// @param selectedArchaeologists the archaeologists the embalmer has selected to curse
    /// @return The index of the new sarcophagus
    function initializeSarcophagus(
        bytes32 sarcoId,
        LibTypes.SarcophagusMemory memory sarcophagus,
        LibTypes.SelectedArchaeologistMemory[] memory selectedArchaeologists
    ) external returns (uint256) {
        // Confirm that this exact sarcophagus does not already exist
        if (
            s.sarcophagi[sarcoId].state !=
            LibTypes.SarcophagusState.DoesNotExist
        ) {
            revert LibErrors.SarcophagusAlreadyExists(sarcoId);
        }

        // Confirm that the resurrection time is in the future
        if (sarcophagus.resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(
                sarcophagus.resurrectionTime
            );
        }

        // Confirm that archaeologists are provided
        if (selectedArchaeologists.length == 0) {
            revert LibErrors.NoArchaeologistsProvided();
        }

        // Confirm that minShards is less than the number of archaeologists
        if (sarcophagus.minShards > selectedArchaeologists.length) {
            revert LibErrors.MinShardsGreaterThanArchaeologists(
                sarcophagus.minShards
            );
        }

        // Confirm that minShards is greater than 0
        if (sarcophagus.minShards == 0) {
            revert LibErrors.MinShardsZero();
        }

        // Initialize a list of archaeologist addresses to be passed in to the
        // sarcophagus object
        address[] memory archaeologistsToBond = new address[](
            selectedArchaeologists.length
        );

        for (uint256 i = 0; i < selectedArchaeologists.length; i++) {
            LibTypes.SelectedArchaeologistMemory memory arch = selectedArchaeologists[i];

            // Confirm that the archaeologist list is unique. This is done by
            // checking that the archaeologist does not already exist from
            // previous iterations in this loop.
            if (LibUtils.archaeologistExistsOnSarc(sarcoId, arch.archAddress)) {
                revert LibErrors.ArchaeologistListNotUnique(
                    archaeologistsToBond
                );
            }

            // Define an archaeologist storage object to be stored on the sarcophagus.
            bytes32 doubleHashedShard = keccak256(abi.encode(arch.hashedShard));
            LibTypes.ArchaeologistStorage memory archaeologistStorage = LibTypes
                .ArchaeologistStorage({
                    diggingFee: arch.diggingFee,
                    diggingFeesPaid: 0,
                    doubleHashedShard: doubleHashedShard,
                    unencryptedShard: "",
                    curseTokenId: 0
                });

            // Map the double-hashed shared to this archaeologist's address for easier referencing on accuse
            s.doubleHashedShardArchaeologists[doubleHashedShard] = arch
                .archAddress;

            // Stores each archaeologist's digging fees and unencrypted
            // shard in app storage per sarcophagus
            s.sarcophagusArchaeologists[sarcoId][
                arch.archAddress
            ] = archaeologistStorage;

            // Add the sarcophagus identifier to archaeologist's list of sarcophagi
            s.archaeologistSarcophagi[arch.archAddress].push(sarcoId);

            // Add the archaeologist address to the list of addresses to be
            // passed in to the sarcophagus object
            archaeologistsToBond[i] = arch.archAddress;
        }

        // Create the sarcophagus object and store it in AppStorage
        s.sarcophagi[sarcoId] = LibTypes.Sarcophagus({
            name: sarcophagus.name,
            state: LibTypes.SarcophagusState.Exists,
            canBeTransferred: sarcophagus.canBeTransferred,
            minShards: sarcophagus.minShards,
            resurrectionTime: sarcophagus.resurrectionTime,
            resurrectionWindow: LibUtils.getGracePeriod(
                sarcophagus.resurrectionTime
            ),
            arweaveTxIds: new string[](0),
            embalmer: msg.sender,
            recipientAddress: sarcophagus.recipient,
            archaeologists: archaeologistsToBond
        });

        // Add the identifier to the necessary data structures
        s.sarcophagusIdentifiers.push(sarcoId);
        s.embalmerSarcophagi[msg.sender].push(sarcoId);
        s.recipientSarcophagi[sarcophagus.recipient].push(sarcoId);

        // Calculate the total fees in sarco tokens that the contract will
        // receive from the embalmer
        uint256 totalFees = LibBonds.calculateTotalFees(
            sarcoId,
            archaeologistsToBond
        );

        // Transfer the total fees amount in sarco token from the msg.sender to this contract
        s.sarcoToken.transferFrom(msg.sender, address(this), totalFees);

        // Emit the event
        emit InitializeSarcophagus(
            sarcoId,
            sarcophagus.name,
            sarcophagus.canBeTransferred,
            sarcophagus.resurrectionTime,
            msg.sender,
            sarcophagus.recipient,
            archaeologistsToBond,
            totalFees
        );

        // Return the index of the sarcophagus
        return s.sarcophagusIdentifiers.length - 1;
    }

    /// @notice Embalmer finalizes the skeleton of a sarcophagus.
    ///
    /// FinalizeSarcophagus is the last step of the two step mummification
    /// process.
    ///
    /// The purpose of finalizeSarcophagus is to:
    ///   - Provide the archaeologists' signatures to the contract. These
    ///     confirm that the archaeologists approve the fees stored on the
    ///     contract and are ready to work.
    ///   - Provide the arweave transaction id to be stored on chain.
    ///   - Reward the archaeologist who uploaded to payload to arweave with the storage fee.
    ///
    /// @dev The archaeologistSignatures must be sent in the same order that the
    /// archaeologists were sent to the initializeSarcophagus function,
    /// otherwise the transaction will revert.
    /// @param sarcoId the identifier of the sarcophagus
    /// @param archaeologistSignatures the signatures of the archaeologists.
    /// This is archaeologist.length - 1 since the arweave archaeologist will be providing their own signature.
    /// @param arweaveTxId the arweave transaction id

    // TODO: when initialize/finalize are combined, the combined method will
    // accept an array of arweaveTxIds (instead of a single one)
    function finalizeSarcophagus(
        bytes32 sarcoId,
        LibTypes.SignatureWithAccount[] memory archaeologistSignatures,
        string memory arweaveTxId
    ) external {
        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the embalmer is making this transaction
        if (s.sarcophagi[sarcoId].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophagi[sarcoId].embalmer
            );
        }

        // Confirm that the sarcophagus is not already finalized by checking if
        // the arweaveTxId is empty
        if (LibUtils.isSarcophagusFinalized(sarcoId)) {
            revert LibErrors.SarcophagusAlreadyFinalized(sarcoId);
        }

        // Confirm that the provided arweave transaction id is not empty
        if (bytes(arweaveTxId).length == 0) {
            revert LibErrors.ArweaveTxIdEmpty();
        }

        // Confirm that the correct number of archaeologist signatures was sent
        if (
            archaeologistSignatures.length !=
            s.sarcophagi[sarcoId].archaeologists.length
        ) {
            revert LibErrors.IncorrectNumberOfArchaeologistSignatures(
                archaeologistSignatures.length
            );
        }

        // Valid each archaeologist signature
        for (uint256 i = 0; i < archaeologistSignatures.length; i++) {
            address archaeologist = archaeologistSignatures[i].account;

            // Confirm that this signauture has not already been verified. This
            // in combination with the signature length check guarantees that
            // each archaeologist gets verified and gets verified only once.
            if (verifiedArchaeologists[sarcoId][archaeologist]) {
                revert LibErrors.SignatureListNotUnique();
            }

            // Confirm that the archaeologist address in the signature is on the
            // sarcophagus. The alternative to this is to iterate over each
            // archaeologist on the sarcophagus and run ecrecover to see if
            // there is a match. This is much more efficient.
            if (!LibUtils.archaeologistExistsOnSarc(sarcoId, archaeologist)) {
                revert LibErrors.ArchaeologistNotOnSarcophagus(archaeologist);
            }

            // TODO: When initialize and finalize are combined, the signature will
            // contain 3 pieces of data:
            // arweaveTxId
            // unencryptedShardHash
            // archaeologistAddress

            // Verify that the signature of the sarcophagus identifier came from
            // the archaeologist. This signature confirms that the archaeologist
            // approves the parameters of the sarcophagus (fees and resurrection
            // time) and is ready to work.
            LibUtils.verifyBytes32Signature(
                sarcoId,
                archaeologistSignatures[i].v,
                archaeologistSignatures[i].r,
                archaeologistSignatures[i].s,
                archaeologist
            );

            // Calculates the archaeologist's cursed bond and curses them (locks
            // up the free bond)
            LibBonds.curseArchaeologist(sarcoId, archaeologist);

            // Add this archaeologist to the mapping of verified archaeologists
            // so that it can't be checked again.
            verifiedArchaeologists[sarcoId][archaeologist] = true;

            // TODO: will be removed
            // Mint the curse token for the archaeologist's role on this sarcophagus
            LibUtils.mintCurseToken(sarcoId, archaeologist);
        }

        // Store the arweave transaction id to the sarcophagus. The arweaveTxId
        // being populated indirectly designates the sarcophagus as finalized.
        s.sarcophagi[sarcoId].arweaveTxIds.push(arweaveTxId);

        // Emit an event
        emit FinalizeSarcophagus(sarcoId, arweaveTxId);
    }

    /// @notice The embalmer may extend the life of the sarcophagus as long as
    /// the resurrection time has not passed yet.
    /// @dev The embalmer sets a new resurrection time sometime in the future.
    /// @param sarcoId the identifier of the sarcophagus
    /// @param resurrectionTime the new resurrection time
    function rewrapSarcophagus(bytes32 sarcoId, uint256 resurrectionTime)
        external
    {
        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the sender is the embalmer
        if (s.sarcophagi[sarcoId].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophagi[sarcoId].embalmer
            );
        }

        // Confirm that the sarcophagus is finalized
        if (!LibUtils.isSarcophagusFinalized(sarcoId)) {
            revert LibErrors.SarcophagusNotFinalized(sarcoId);
        }

        // Confirm that the current resurrection time is in the future, and thus rewrappable
        if (s.sarcophagi[sarcoId].resurrectionTime <= block.timestamp) {
            revert LibErrors.SarcophagusIsUnwrappable();
        }

        // Confirm that the new resurrection time is in the future
        if (resurrectionTime <= block.timestamp) {
            revert LibErrors.NewResurrectionTimeInPast(resurrectionTime);
        }

        // For each archaeologist on the sarcophagus, transfer their digging fee allocations to them
        address[] memory bondedArchaeologists = s
            .sarcophagi[sarcoId]
            .archaeologists;

        uint256 diggingFeeSum = 0;

        for (uint256 i = 0; i < bondedArchaeologists.length; i++) {
            // Get the archaeolgist's fee data
            LibTypes.ArchaeologistStorage memory archaeologistData = LibUtils
                .getArchaeologist(sarcoId, bondedArchaeologists[i]);

            // Transfer the archaeologist's digging fee allocation to the archaeologist's reward pool
            LibRewards.increaseRewardPool(
                bondedArchaeologists[i],
                archaeologistData.diggingFee
            );

            // Add to the total of digging fees paid
            archaeologistData.diggingFeesPaid += archaeologistData.diggingFee;

            // Add to the total of digging fees paid on the nft attributes
            s.curses.updateAttribute(
                archaeologistData.curseTokenId,
                abi.encodePacked("Digging Fees Paid"),
                abi.encodePacked(
                    Strings.toString(archaeologistData.diggingFeesPaid)
                )
            );

            // Add the archaeologist's digging fee to the sum
            diggingFeeSum += archaeologistData.diggingFee;

            // Update the resurrection time on the archaeologist's nft
            s.curses.updateAttribute(
                archaeologistData.curseTokenId,
                abi.encodePacked("Resurrection Time"),
                abi.encodePacked(Strings.toString(resurrectionTime))
            );

            // Update the archaeologist's data in storage
            s.sarcophagusArchaeologists[sarcoId][
                bondedArchaeologists[i]
            ] = archaeologistData;
        }

        uint256 protocolFee = LibUtils.calculateProtocolFee();

        // Add the protocol fee to the total protocol fees in storage
        s.totalProtocolFees += protocolFee;

        // Set resurrection time to infinity
        s.sarcophagi[sarcoId].resurrectionTime = resurrectionTime;

        // Transfer the new digging fees from the embalmer to the sarcophagus contract.
        // Archaeologists may withdraw their due from their respective reward pools
        s.sarcoToken.transferFrom(
            msg.sender,
            address(this),
            diggingFeeSum + protocolFee
        );

        // Emit an event
        emit RewrapSarcophagus(sarcoId, resurrectionTime);
    }

    /// @notice Cancels a sarcophagus. An embalmer may cancel a sarcophagus after
    /// `initializeSarcophagus` but before `finalizeSarcophagus`. The embalmer's
    /// fees that were locked up will be refunded.
    /// @param sarcoId the identifier of the sarcophagus
    function cancelSarcophagus(bytes32 sarcoId) external {
        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the sender is the embalmer
        if (s.sarcophagi[sarcoId].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophagi[sarcoId].embalmer
            );
        }

        // Confirm that the sarcophagus is not already finalized
        if (LibUtils.isSarcophagusFinalized(sarcoId)) {
            revert LibErrors.SarcophagusAlreadyFinalized(sarcoId);
        }

        // Set the sarcophagus state to done
        s.sarcophagi[sarcoId].state = LibTypes.SarcophagusState.Done;

        address[] memory bondedArchaeologists = s
            .sarcophagi[sarcoId]
            .archaeologists;

        // Re-calculate the total fees that the embalmer locked up in initializeSarcophagus
        uint256 totalFees = LibBonds.calculateTotalFees(
            sarcoId,
            bondedArchaeologists
        );

        // Transfer the total fees back to the embalmer
        s.sarcoToken.transfer(s.sarcophagi[sarcoId].embalmer, totalFees);

        // Emit an event
        emit CancelSarcophagus(sarcoId);
    }

    /// @notice Permanently closes the sarcophagus, giving it no opportunity to
    /// be resurrected.
    /// This may only be done after finalizeSarcophagus and before the
    /// resurrection time has passed.
    /// @dev Extends the resurrection time into infinity so that that unwrap
    /// will never be successful.
    /// @param sarcoId the identifier of the sarcophagus
    function burySarcophagus(bytes32 sarcoId) external {
        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the sender is the embalmer
        if (s.sarcophagi[sarcoId].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophagi[sarcoId].embalmer
            );
        }

        // Confirm that the sarcophagus is finalized by checking if there is an
        // arweaveTxId
        if (!LibUtils.isSarcophagusFinalized(sarcoId)) {
            revert LibErrors.SarcophagusNotFinalized(sarcoId);
        }

        // Confirm that the current resurrection time is in the future
        if (s.sarcophagi[sarcoId].resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(
                s.sarcophagi[sarcoId].resurrectionTime
            );
        }

        // Set resurrection time to infinity
        s.sarcophagi[sarcoId].resurrectionTime = 2**256 - 1;

        // Set sarcophagus state to done
        s.sarcophagi[sarcoId].state = LibTypes.SarcophagusState.Done;

        // For each archaeologist on the sarcophagus,
        // 1. Unlock their cursed bond
        // 2. Transfer digging fees to the archaeologist.
        address[] memory bondedArchaeologists = s
            .sarcophagi[sarcoId]
            .archaeologists;

        for (uint256 i = 0; i < bondedArchaeologists.length; i++) {
            // Unlock the archaeologist's cursed bond
            LibBonds.freeArchaeologist(sarcoId, bondedArchaeologists[i]);

            LibTypes.ArchaeologistStorage memory archaeologistData = LibUtils
                .getArchaeologist(sarcoId, bondedArchaeologists[i]);

            // Transfer the digging fees to the archaeologist's reward pool
            LibRewards.increaseRewardPool(
                bondedArchaeologists[i],
                archaeologistData.diggingFee
            );
        }

        // Emit an event
        emit BurySarcophagus(sarcoId);
    }
}
