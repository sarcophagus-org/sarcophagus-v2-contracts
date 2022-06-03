// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../libraries/LibTypes.sol";
import "../../libraries/LibUtils.sol";
import "../../libraries/LibEvents.sol";
import {LibDiamond} from "../../diamond/libraries/LibDiamond.sol";
import {LibArchaeologists} from "../archaeologists/LibArchaeologists.sol";
import {LibAppStorage, AppStorage} from "../../storage/LibAppStorage.sol";

/// @title The sarcophaguses library
/// @dev This library contains the internal and shared functions for sarcophaguses feature
library LibSarcophaguses {
    struct Rewards {
        uint256 storageFee;
        uint256 diggingFee;
        uint256 bounty;
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
        LibArchaeologists.decreaseCursedBond(paymentAddress, halfToSender);

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
        AppStorage storage s = LibAppStorage.diamondStorage();

        // confirm that the archaeologist exists
        LibArchaeologists.archaeologistExists(archaeologist, true);

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

        uint256 cursedBondAmount = LibArchaeologists.getCursedBond(
            rewards.diggingFee,
            rewards.bounty
        );

        // lock up that bond
        LibArchaeologists.lockUpBond(archaeologist, cursedBondAmount);

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
