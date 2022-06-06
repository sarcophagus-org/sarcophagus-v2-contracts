// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import "../libraries/LibPrivateKeys.sol";
import "../libraries/LibUtils.sol";
import "../libraries/LibEvents.sol";
import {LibDiamond} from "../diamond/libraries/LibDiamond.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";
import {ArchaeologistsFacet} from "./ArchaeologistsFacet.sol";

/// @title The sarcophaguses facet
/// @dev This facet/contract contains the external functions for the sarcophaguses feature
contract SarcophagusesFacet {
    AppStorage internal s;

    // These values are combined to reduce the number of arguments passed in to
    // the createSarcophagus function in order to prevent the "stack too deep"
    // error
    struct Rewards {
        uint256 storageFee;
        uint256 diggingFee;
        uint256 bounty;
    }

    /**
     * @notice Embalmer creates the skeleton for a new sarcopahgus.
     * @dev This is the external version of createSarcophaguses. The main
     * purpose of this external version is to combine the storageFee,
     * diggingFee, and bounty into one struct. This prevents a "stack too deep"
     * error.
     * @param name the name of the sarcophagus
     * @param archaeologist the address of a registered archaeologist to
     * assign this sarcophagus to
     * @param resurrectionTime the resurrection time of the sarcophagus
     * @param storageFee the storage fee that the archaeologist will receive,
     * for saving this sarcophagus on Arweave
     * @param diggingFee the digging fee that the archaeologist will receive at
     * the first rewrap
     * @param bounty the bounty that the archaeologist will receive when the
     * sarcophagus is unwrapped
     * @param identifier the identifier of the sarcophagus, which is the hash
     * of the hash of the inner encrypted layer of the sarcophagus
     * @param recipientPublicKey the public key of the recipient
     * @param sarcoToken the SARCO token used for payment handling
     * @return index of the new sarcophagus
     */
    function createSarcophagus(
        string memory name,
        address archaeologist,
        uint256 resurrectionTime,
        uint256 storageFee,
        uint256 diggingFee,
        uint256 bounty,
        bytes32 identifier,
        bytes memory recipientPublicKey,
        IERC20 sarcoToken
    ) external returns (uint256) {
        Rewards memory rewards = Rewards(storageFee, diggingFee, bounty);
        return
            createSarcophagus(
                name,
                archaeologist,
                resurrectionTime,
                rewards,
                identifier,
                recipientPublicKey,
                sarcoToken
            );
    }

    /**
     * @notice Embalmer updates a sarcophagus given it's identifier, after
     * the archaeologist has uploaded the encrypted payload onto Arweave
     * @param newPublicKey the archaeologist's new public key, to use for
     * encrypting the next sarcophagus that they're assigned to
     * @param identifier the identifier of the sarcophagus
     * @param assetId the identifier of the encrypted asset on Arweave
     * @param v signature element
     * @param r signature element
     * @param sSigElement signature element
     * @param sarcoToken the SARCO token used for payment handling
     * @return bool indicating that the update was successful
     */
    function updateSarcophagus(
        bytes memory newPublicKey,
        bytes32 identifier,
        string memory assetId,
        uint8 v,
        bytes32 r,
        bytes32 sSigElement,
        IERC20 sarcoToken
    ) external returns (bool) {
        // load the sarcophagus, and make sure it exists
        LibTypes.Sarcophagus storage sarc = s.sarcophaguses[identifier];
        sarcophagusState(sarc.state, LibTypes.SarcophagusStates.Exists);

        // verify that the embalmer is making this transaction
        LibUtils.sarcophagusUpdater(sarc.embalmer);

        // verify that the sarcophagus does not currently have an assetId, and
        // that we are setting an actual assetId
        LibUtils.assetIdsCheck(sarc.assetId, assetId);

        // verify that the archaeologist's new public key, and the assetId,
        // actually came from the archaeologist and were not tampered
        LibUtils.signatureCheck(
            abi.encodePacked(newPublicKey, assetId),
            v,
            r,
            sSigElement,
            sarc.archaeologist
        );

        // revert if the new public key coming from the archaeologist has
        // already been used
        require(
            !s.archaeologistUsedKeys[sarc.archaeologistPublicKey],
            "public key already used"
        );

        // make sure that the new public key can't be used again in the future
        s.archaeologistUsedKeys[sarc.archaeologistPublicKey] = true;

        // set the assetId on the sarcophagus
        sarc.assetId = assetId;

        // load up the archaeologist
        LibTypes.Archaeologist storage arch = s.archaeologists[
            sarc.archaeologist
        ];

        // set the new public key on the archaeologist
        arch.currentPublicKey = newPublicKey;

        // transfer the storage fee to the archaeologist
        sarcoToken.transfer(arch.paymentAddress, sarc.storageFee);
        sarc.storageFee = 0;

        // emit some events
        emit LibEvents.UpdateSarcophagus(identifier, assetId);
        emit LibEvents.UpdateArchaeologistPublicKey(
            sarc.archaeologist,
            arch.currentPublicKey
        );

        // return true
        return true;
    }

    /**
     * @notice An embalmer may cancel a sarcophagus if it hasn't been
     * completely created
     * @param identifier the identifier of the sarcophagus
     * @param sarcoToken the SARCO token used for payment handling
     * @return bool indicating that the cancel was successful
     */
    function cancelSarcophagus(bytes32 identifier, IERC20 sarcoToken)
        public
        returns (bool)
    {
        // load the sarcophagus, and make sure it exists
        LibTypes.Sarcophagus storage sarc = s.sarcophaguses[identifier];
        sarcophagusState(sarc.state, LibTypes.SarcophagusStates.Exists);

        // verify that the asset id has not yet been set
        LibUtils.confirmAssetIdNotSet(sarc.assetId);

        // verify that the embalmer is making this transaction
        LibUtils.sarcophagusUpdater(sarc.embalmer);

        // transfer the bounty and storage fee back to the embalmer
        sarcoToken.transfer(sarc.embalmer, sarc.bounty + sarc.storageFee);

        // load the archaeologist
        LibTypes.Archaeologist memory arch = s.archaeologists[
            sarc.archaeologist
        ];

        // transfer the digging fee over to the archaeologist
        sarcoToken.transfer(arch.paymentAddress, sarc.diggingFee);

        // free up the cursed bond on the archaeologist, because this
        // sarcophagus is over
        ArchaeologistsFacet(address(this)).freeUpBond(
            sarc.archaeologist,
            sarc.currentCursedBond
        );

        // TODO: Fix state change after transfer (possible re-entrancy vulnerability)
        // set the sarcophagus state to Done
        sarc.state = LibTypes.SarcophagusStates.Done;

        // save the fact that this sarcophagus has been cancelled, against the
        // archaeologist
        s.archaeologistCancels[sarc.archaeologist].push(identifier);

        // emit an event
        emit LibEvents.CancelSarcophagus(identifier);

        // return true
        return true;
    }

    /**
     * @notice Embalmer can extend the resurrection time of the sarcophagus,
     * as long as the previous resurrection time is in the future
     * @param identifier the identifier of the sarcophagus
     * @param resurrectionTime new resurrection time for the rewrapped
     * sarcophagus
     * @param diggingFee new digging fee for the rewrapped sarcophagus
     * @param bounty new bounty for the rewrapped sarcophagus
     * @param sarcoToken the SARCO token used for payment handling
     * @return bool indicating that the rewrap was successful
     */
    function rewrapSarcophagus(
        bytes32 identifier,
        uint256 resurrectionTime,
        uint256 diggingFee,
        uint256 bounty,
        IERC20 sarcoToken
    ) public returns (bool) {
        // load the sarcophagus, and make sure it exists
        LibTypes.Sarcophagus storage sarc = s.sarcophaguses[identifier];
        sarcophagusState(sarc.state, LibTypes.SarcophagusStates.Exists);

        // verify that the embalmer is making this transaction
        LibUtils.sarcophagusUpdater(sarc.embalmer);

        // verify that both the current resurrection time, and the new
        // resurrection time, are in the future
        LibUtils.resurrectionInFuture(sarc.resurrectionTime);
        LibUtils.resurrectionInFuture(resurrectionTime);

        // load the archaeologist
        LibTypes.Archaeologist storage arch = s.archaeologists[
            sarc.archaeologist
        ];

        // check that the sarcophagus updated parameters fit within the
        // archaeologist's parameters
        LibUtils.withinArchaeologistLimits(
            resurrectionTime,
            diggingFee,
            bounty,
            arch.maximumResurrectionTime,
            arch.minimumDiggingFee,
            arch.minimumBounty
        );

        // transfer the new digging fee from embalmer to this contract
        sarcoToken.transferFrom(msg.sender, address(this), diggingFee);

        // transfer the old digging fee to the archaeologist
        sarcoToken.transfer(arch.paymentAddress, sarc.diggingFee);

        ArchaeologistsFacet archaeologistsFacet = ArchaeologistsFacet(
            address(this)
        );

        // calculate the amount of archaeologist's bond to lock up
        uint256 cursedBondAmount = archaeologistsFacet.getCursedBond(
            diggingFee,
            bounty
        );

        // if new cursed bond amount is greater than current cursed bond
        // amount, calculate difference and lock it up. if it's less than,
        // calculate difference and free it up.
        if (cursedBondAmount > sarc.currentCursedBond) {
            uint256 diff = cursedBondAmount - sarc.currentCursedBond;
            ArchaeologistsFacet(address(this)).lockUpBond(
                sarc.archaeologist,
                diff
            );
        } else if (cursedBondAmount < sarc.currentCursedBond) {
            uint256 diff = sarc.currentCursedBond - cursedBondAmount;
            ArchaeologistsFacet(address(this)).freeUpBond(
                sarc.archaeologist,
                diff
            );
        }

        // determine the new grace period for the archaeologist's final proof
        uint256 gracePeriod = LibUtils.getGracePeriod(resurrectionTime);

        // set variarbles on the sarcopahgus
        // TODO: Fix state change after transfer (possible re-entrancy vulnerability)
        sarc.resurrectionTime = resurrectionTime;
        sarc.diggingFee = diggingFee;
        sarc.bounty = bounty;
        sarc.currentCursedBond = cursedBondAmount;
        sarc.resurrectionWindow = gracePeriod;

        // emit an event
        emit LibEvents.RewrapSarcophagus(
            sarc.assetId,
            identifier,
            resurrectionTime,
            gracePeriod,
            diggingFee,
            bounty,
            cursedBondAmount
        );

        // return true
        return true;
    }

    /**
     * @notice Given a sarcophagus identifier, preimage, and private key,
     * verify that the data is valid and close out that sarcophagus
     * @param identifier the identifier of the sarcophagus
     * @param privateKey the archaeologist's private key which will decrypt the
     * @param sarcoToken the SARCO token used for payment handling
     * outer layer of the encrypted payload on Arweave
     * @return bool indicating that the unwrap was successful
     */
    function unwrapSarcophagus(
        bytes32 identifier,
        bytes32 privateKey,
        IERC20 sarcoToken
    ) public returns (bool) {
        // load the sarcophagus, and make sure it exists
        LibTypes.Sarcophagus storage sarc = s.sarcophaguses[identifier];
        sarcophagusState(sarc.state, LibTypes.SarcophagusStates.Exists);

        // verify that we're in the resurrection window
        LibUtils.unwrapTime(sarc.resurrectionTime, sarc.resurrectionWindow);

        // verify that the given private key derives the public key on the
        // sarcophagus
        require(
            LibPrivateKeys.keyVerification(
                privateKey,
                sarc.archaeologistPublicKey
            ),
            "!privateKey"
        );

        // save that private key onto the sarcophagus model
        sarc.privateKey = privateKey;

        // load up the archaeologist
        LibTypes.Archaeologist memory arch = s.archaeologists[
            sarc.archaeologist
        ];

        // transfer the Digging fee and bounty over to the archaeologist
        sarcoToken.transfer(arch.paymentAddress, sarc.diggingFee + sarc.bounty);

        // free up the archaeologist's cursed bond, because this sarcophagus is
        // done
        ArchaeologistsFacet(address(this)).freeUpBond(
            sarc.archaeologist,
            sarc.currentCursedBond
        );

        // set the sarcophagus to Done
        sarc.state = LibTypes.SarcophagusStates.Done;

        // save this successful sarcophagus against the archaeologist
        s.archaeologistSuccesses[sarc.archaeologist].push(identifier);

        // emit an event
        emit LibEvents.UnwrapSarcophagus(sarc.assetId, identifier, privateKey);

        // return true
        return true;
    }

    /**
     * @notice Given a sarcophagus, accuse the archaeologist for unwrapping the
     * sarcophagus early
     * @param identifier the identifier of the sarcophagus
     * @param singleHash the preimage of the sarcophagus identifier
     * @param paymentAddress the address to receive payment for accusing the
     * archaeologist
     * @param sarcoToken the SARCO token used for payment handling
     * @return bool indicating that the accusal was successful
     */
    function accuseArchaeologist(
        bytes32 identifier,
        bytes memory singleHash,
        address paymentAddress,
        IERC20 sarcoToken
    ) public returns (bool) {
        // load the sarcophagus, and make sure it exists
        LibTypes.Sarcophagus storage sarc = s.sarcophaguses[identifier];
        sarcophagusState(sarc.state, LibTypes.SarcophagusStates.Exists);

        // verify that the resurrection time is in the future
        LibUtils.resurrectionInFuture(sarc.resurrectionTime);

        // verify that the accuser has data which proves that the archaeologist
        // released the payload too early
        LibUtils.hashCheck(identifier, singleHash);

        // reward this transaction's caller, and the embalmer, with the cursed
        // bond, and refund the rest of the payment (bounty and digging fees)
        // back to the embalmer
        (uint256 halfToSender, uint256 halfToEmbalmer) = splitSend(
            paymentAddress,
            sarc,
            sarcoToken
        );

        // save the accusal against the archaeologist
        s.archaeologistAccusals[sarc.archaeologist].push(identifier);

        // update sarcophagus state to Done
        sarc.state = LibTypes.SarcophagusStates.Done;

        // emit an event
        emit LibEvents.AccuseArchaeologist(
            identifier,
            msg.sender,
            halfToSender,
            halfToEmbalmer
        );

        // return true
        return true;
    }

    /**
     * @notice Extends a sarcophagus resurrection time into infinity
     * effectively signaling that the sarcophagus is over and should never be
     * resurrected
     * @param identifier the identifier of the sarcophagus
     * @param sarcoToken the SARCO token used for payment handling
     * @return bool indicating that the bury was successful
     */
    function burySarcophagus(bytes32 identifier, IERC20 sarcoToken)
        public
        returns (bool)
    {
        // load the sarcophagus, and make sure it exists
        LibTypes.Sarcophagus storage sarc = s.sarcophaguses[identifier];
        sarcophagusState(sarc.state, LibTypes.SarcophagusStates.Exists);

        // verify that the embalmer made this transaction
        LibUtils.sarcophagusUpdater(sarc.embalmer);

        // verify that the existing resurrection time is in the future
        LibUtils.resurrectionInFuture(sarc.resurrectionTime);

        // load the archaeologist
        LibTypes.Archaeologist storage arch = s.archaeologists[
            sarc.archaeologist
        ];

        // free the archaeologist's bond, because this sarcophagus is over
        ArchaeologistsFacet(address(this)).freeUpBond(
            sarc.archaeologist,
            sarc.currentCursedBond
        );

        // transfer the digging fee to the archae
        sarcoToken.transfer(arch.paymentAddress, sarc.diggingFee);

        // TODO: Fix state change after transfer (possible re-entrancy vulnerability)
        // set the resurrection time of this sarcopahgus at maxint
        sarc.resurrectionTime = 2**256 - 1;

        // update sarcophagus state to Done
        sarc.state = LibTypes.SarcophagusStates.Done;

        // emit an event
        emit LibEvents.BurySarcophagus(identifier);

        // return true
        return true;
    }

    /**
     * @notice Clean up a sarcophagus whose resurrection time and window have
     * passed. Callable by anyone.
     * @param identifier the identifier of the sarcophagus
     * @param paymentAddress the address to receive payment for cleaning up the
     * sarcophagus
     * @param sarcoToken the SARCO token used for payment handling
     * @return bool indicating that the clean up was successful
     */
    function cleanUpSarcophagus(
        bytes32 identifier,
        address paymentAddress,
        IERC20 sarcoToken
    ) public returns (bool) {
        // load the sarcophagus, and make sure it exists
        LibTypes.Sarcophagus storage sarc = s.sarcophaguses[identifier];
        sarcophagusState(sarc.state, LibTypes.SarcophagusStates.Exists);

        // verify that the resurrection window has expired
        require(
            sarc.resurrectionTime + sarc.resurrectionWindow < block.timestamp,
            "sarcophagus resurrection period must be in the past"
        );

        // reward this transaction's caller, and the embalmer, with the cursed
        // bond, and refund the rest of the payment (bounty and digging fees)
        // back to the embalmer
        (uint256 halfToSender, uint256 halfToEmbalmer) = splitSend(
            paymentAddress,
            sarc,
            sarcoToken
        );

        // save the cleanup against the archaeologist
        s.archaeologistCleanups[sarc.archaeologist].push(identifier);

        // update sarcophagus state to Done
        sarc.state = LibTypes.SarcophagusStates.Done;

        // emit an event
        emit LibEvents.CleanUpSarcophagus(
            identifier,
            msg.sender,
            halfToSender,
            halfToEmbalmer
        );

        return true;
    }

    /**
     * @notice Reverts if the given sarcState does not equal the comparison
     * state
     * @param sarcState the state of a sarcophagus
     * @param state the state to compare to
     */
    function sarcophagusState(
        LibTypes.SarcophagusStates sarcState,
        LibTypes.SarcophagusStates state
    ) internal pure {
        // set the error message
        string memory error = "sarcophagus already exists";
        if (state == LibTypes.SarcophagusStates.Exists)
            error = "sarcophagus does not exist or is not active";

        // revert if states are not equal
        require(sarcState == state, error);
    }

    /**
     * @notice Takes a sarcophagus's cursed bond, splits it in half, and sends
     * to the transaction caller and embalmer
     * @param paymentAddress payment address for the transaction caller
     * @param sarc the sarcophagus to operate on
     * @param sarcoToken the SARCO token used for payment handling
     * @return halfToEmbalmer the amount of SARCO token going to embalmer
     */
    function splitSend(
        address paymentAddress,
        LibTypes.Sarcophagus storage sarc,
        IERC20 sarcoToken
    ) internal returns (uint256, uint256) {
        // split the sarcophagus's cursed bond into two halves, taking into
        // account solidity math
        uint256 halfToEmbalmer = sarc.currentCursedBond / 2;
        uint256 halfToSender = sarc.currentCursedBond - halfToEmbalmer;

        // transfer the cursed half, plus bounty, plus digging fee to the
        // embalmer
        sarcoToken.transfer(
            sarc.embalmer,
            sarc.bounty + sarc.diggingFee + halfToEmbalmer
        );

        // transfer the other half of the cursed bond to the transaction caller
        sarcoToken.transfer(paymentAddress, halfToSender);

        // update (decrease) the archaeologist's cursed bond, because this
        // sarcophagus is over
        ArchaeologistsFacet(address(this)).decreaseCursedBond(
            paymentAddress,
            halfToSender
        );

        // return data
        return (halfToSender, halfToEmbalmer);
    }

    /**
     * @notice Embalmer creates the skeleton for a new sarcopahgus.
     * @dev This is the internal version of createSarcophagus. The internal
     * version was created to reduce the number of arguments passed in to the
     * function in order to avoid the "stack too deep" error. This is done by
     * combining storage fees, bounty, and digging fees into a single struct
     * called Rewards.
     * @param name the name of the sarcophagus
     * @param archaeologist the address of a registered archaeologist to
     * assign this sarcophagus to
     * @param resurrectionTime the resurrection time of the sarcophagus
     * @param rewards rewards
     * @param identifier the identifier of the sarcophagus, which is the hash
     * of the hash of the inner encrypted layer of the sarcophagus
     * @param recipientPublicKey the public key of the recipient
     * @param sarcoToken the SARCO token used for payment handling
     * @return index of the new sarcophagus
     */
    function createSarcophagus(
        string memory name,
        address archaeologist,
        uint256 resurrectionTime,
        Rewards memory rewards,
        bytes32 identifier,
        bytes memory recipientPublicKey,
        IERC20 sarcoToken
    ) internal returns (uint256) {
        // confirm that the archaeologist exists
        ArchaeologistsFacet(address(this)).archaeologistExists(
            archaeologist,
            true
        );

        // confirm that the public key length is correct
        LibUtils.publicKeyLength(recipientPublicKey);

        // confirm that this exact sarcophagus does not yet exist
        sarcophagusState(
            s.sarcophaguses[identifier].state,
            LibTypes.SarcophagusStates.DoesNotExist
        );

        // confirm that the resurrection time is in the future
        LibUtils.resurrectionInFuture(resurrectionTime);

        // load the archaeologist
        LibTypes.Archaeologist memory arch = s.archaeologists[archaeologist];

        // check that the new sarcophagus parameters fit within the selected
        // archaeologist's parameters
        LibUtils.withinArchaeologistLimits(
            resurrectionTime,
            rewards.diggingFee,
            rewards.bounty,
            arch.maximumResurrectionTime,
            arch.minimumDiggingFee,
            arch.minimumBounty
        );

        uint256 cursedBondAmount = ArchaeologistsFacet(address(this))
            .getCursedBond(rewards.diggingFee, rewards.bounty);

        // lock up that bond
        ArchaeologistsFacet(address(this)).lockUpBond(
            archaeologist,
            cursedBondAmount
        );

        // create a new sarcophagus
        LibTypes.Sarcophagus memory sarc = LibTypes.Sarcophagus({
            state: LibTypes.SarcophagusStates.Exists,
            archaeologist: archaeologist,
            archaeologistPublicKey: arch.currentPublicKey,
            embalmer: msg.sender,
            name: name,
            resurrectionTime: resurrectionTime,
            resurrectionWindow: LibUtils.getGracePeriod(resurrectionTime),
            assetId: "",
            recipientPublicKey: recipientPublicKey,
            storageFee: rewards.storageFee,
            diggingFee: rewards.diggingFee,
            bounty: rewards.bounty,
            currentCursedBond: cursedBondAmount,
            privateKey: 0
        });

        // derive the recipient's address from their public key
        address recipientAddress = address(
            uint160(uint256(keccak256(recipientPublicKey)))
        );

        // save the sarcophagus into necessary data structures
        s.sarcophaguses[identifier] = sarc;
        s.sarcophagusIdentifiers.push(identifier);
        s.embalmerSarcophaguses[msg.sender].push(identifier);
        s.archaeologistSarcophaguses[archaeologist].push(identifier);
        s.recipientSarcophaguses[recipientAddress].push(identifier);

        // transfer digging fee + bounty + storage fee from embalmer to this
        // contract
        sarcoToken.transferFrom(
            msg.sender,
            address(this),
            rewards.diggingFee + rewards.bounty + rewards.storageFee
        );

        // emit event with all the data
        emit LibEvents.CreateSarcophagus(
            identifier,
            sarc.archaeologist,
            sarc.archaeologistPublicKey,
            sarc.embalmer,
            sarc.name,
            sarc.resurrectionTime,
            sarc.resurrectionWindow,
            sarc.storageFee,
            sarc.diggingFee,
            sarc.bounty,
            sarc.recipientPublicKey,
            sarc.currentCursedBond
        );

        // return index of the new sarcophagus
        return s.sarcophagusIdentifiers.length - 1;
    }
}
