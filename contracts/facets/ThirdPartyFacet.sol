// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract ThirdPartyFacet {
    AppStorage internal s;

    event AccuseSignatory(
        bytes32 indexed vaultId,
        address indexed accuser,
        uint256 accuserBondReward,
        uint256 vaultOwnerBondReward
    );

    event CleanUpVault(
        bytes32 indexed vaultId,
        address indexed cleaner,
        uint256 cleanerBondReward,
        uint256 vaultOwnerBondReward
    );

    /// @notice Close a vault that has not been unwrapped within its grace period
    /// @param vaultId The identifier of the vault to clean
    /// @param paymentAddress The address to which rewards will be sent
    function clean(bytes32 vaultId, address paymentAddress) external {
        LibTypes.Vault storage vault = s.vaults[vaultId];

        if (vault.state != LibTypes.VaultState.Exists) {
            revert LibErrors.VaultDoesNotExist(vaultId);
        }

        // Make sure the vault is cleanable
        if (block.timestamp < s.gracePeriod + vault.resurrectionTime) {
            revert LibErrors.VaultNotCleanable();
        }

        // Figure out which signatories did not fulfil their duties;
        // accumulate their digging fees
        address[] memory signatoryAddresses = vault.signatories;

        uint256 totalCursedBond;
        uint256 totalDiggingFee;

        for (uint256 i = 0; i < signatoryAddresses.length; i++) {
            bool didNotUnwrap = s.signatoryVaultSuccesses[signatoryAddresses[i]][
                vaultId
            ] == false;

            if (didNotUnwrap) {
                LibTypes.SignatoryStorage memory defaulter = s
                    .vaultSignatories[vaultId][signatoryAddresses[i]];

                totalDiggingFee += defaulter.diggingFee;

                uint256 cursedBond = LibBonds.calculateCursedBond(
                    defaulter.diggingFee
                );

                totalCursedBond += cursedBond;

                // decrease the defaulter's cursed bond
                LibBonds.decreaseCursedBond(signatoryAddresses[i], cursedBond);

                // Save the failure to unwrap against the signatory
                s.signatoryCleanups[signatoryAddresses[i]].push(vaultId);
            }
        }

        (
            uint256 cleanerBondReward,
            uint256 vaultOwnerBondReward
        ) = _distributeLoot(
                paymentAddress,
                vault,
                totalCursedBond,
                totalDiggingFee
            );

        vault.state = LibTypes.VaultState.Done;

        emit CleanUpVault(
            vaultId,
            msg.sender,
            cleanerBondReward,
            vaultOwnerBondReward
        );
    }

    /**
     * @notice Accuse signatories of bad behaviour, by providing proof of leaked
     * unencrypted shards before a vault is ready to be unwrapped. The minumum
     * number of shards required to unwrap the vault should be provided for a
     * a successful accusal.
     * of the cursed bonds of the signatorys back to them, and un-curses their bonds.
     * @param vaultId The identifier of the vault having leaked shards
     * @param unencryptedShardHashes At least 'm' unencrypted shard hashes as proof of bad behaviour
     * @param paymentAddress the address to which rewards should be sent if successful
     */
    function accuse(
        bytes32 vaultId,
        bytes32[] memory unencryptedShardHashes,
        address paymentAddress
    ) external {
        LibTypes.Vault storage vault = s.vaults[vaultId];

        if (vault.state != LibTypes.VaultState.Exists) {
            revert LibErrors.VaultDoesNotExist(vaultId);
        }

        if (vault.resurrectionTime < block.timestamp) {
            revert LibErrors.VaultIsUnwrappable();
        }

        if (unencryptedShardHashes.length < vault.minShards) {
            revert LibErrors.AccuseNotEnoughProof(
                unencryptedShardHashes.length,
                vault.minShards
            );
        }

        address[] memory accusedSignatoryAddresses = new address[](
            unencryptedShardHashes.length
        );

        // For each provided shard hash, check if its hash matches one on storage. If so, flag that
        // signatory as accusable
        uint256 diggingFeesToBeDistributed = 0;
        uint256 totalCursedBond = 0;
        uint256 pos = 0;
        for (uint256 i = 0; i < unencryptedShardHashes.length; i++) {
            bytes32 shardDoubleHash = keccak256(
                abi.encode(unencryptedShardHashes[i])
            );

            address matchingSignatoryAddr = s.doubleHashedShardSignatories[
                shardDoubleHash
            ];

            LibTypes.SignatoryStorage storage badSignatory = s
                .vaultSignatories[vaultId][matchingSignatoryAddr];

            if (badSignatory.unencryptedShardDoubleHash == shardDoubleHash) {
                accusedSignatoryAddresses[pos++] = matchingSignatoryAddr;

                uint256 cursedBond = LibBonds.calculateCursedBond(
                    badSignatory.diggingFee
                );

                diggingFeesToBeDistributed += badSignatory.diggingFee;
                totalCursedBond += cursedBond;

                LibBonds.decreaseCursedBond(matchingSignatoryAddr, cursedBond);

                // Save the accusal against the signatory
                s.signatoryAccusals[matchingSignatoryAddr].push(vaultId);
            } else {
                revert LibErrors.AccuseIncorrectProof();
            }
        }

        // At this point, we need to filter out unaccused signatorys in order to reimburse them.
        address[] memory bondedSignatories = s
            .vaults[vaultId]
            .signatories;

        for (uint256 i = 0; i < bondedSignatories.length; i++) {
            // Need to check each signatory address on the vault
            bool isUnaccused = true;

            for (uint256 j = 0; j < accusedSignatoryAddresses.length; j++) {
                // For each signatory address, if found in accusedSignatoryAddresses,
                // then don't add to unaccusedSignatorysAddresses
                if (bondedSignatories[i] == accusedSignatoryAddresses[j]) {
                    isUnaccused = false;
                    break;
                }
            }

            // If this signatory address wasn't in the accused list, free it from its curse
            if (isUnaccused) {
                // There are technically no rewards here, since the vault
                // has been compromised, so here this effectively merely resets
                // the state of the non-malicious signatories, as if they never
                // bonded to this vault in the first place.
                //
                // Of course, whatever rewards they might have gained in previous
                // rewraps remains theirs.
                LibBonds.freeSignatory(vaultId, bondedSignatories[i]);
            }
        }

        (
            uint256 accuserBondReward,
            uint256 vaultOwnerBondReward
        ) = _distributeLoot(
                paymentAddress,
                vault,
                totalCursedBond,
                diggingFeesToBeDistributed
            );

        vault.state = LibTypes.VaultState.Done;

        emit AccuseSignatory(
            vaultId,
            msg.sender,
            accuserBondReward,
            vaultOwnerBondReward
        );
    }

    /**
     * @notice Takes a vault's cursed bond, splits it in half, and sends
     * to paymentAddress and vaultOwner
     * @param paymentAddress payment address for the transaction caller
     * @param vault the vault to operate on
     * @param totalCursedBond the sum of cursed bonds of all signatorys that failed to fulfil their duties
     * @param totalDiggingFee the sum of digging fees of all signatorys that failed to fulfil their duties
     * @return halfToSender the amount of SARCO token going to transaction
     * sender
     * @return halfToEmbalmer the amount of SARCO token going to vaultOwner
     */
    function _distributeLoot(
        address paymentAddress,
        LibTypes.Vault storage vault,
        uint256 totalCursedBond,
        uint256 totalDiggingFee
    ) private returns (uint256, uint256) {
        // split the vault's cursed bond into two halves
        uint256 halfToEmbalmer = totalCursedBond / 2;
        uint256 halfToSender = totalCursedBond - halfToEmbalmer;

        // transfer the cursed half, plus digging fee to the
        // vaultOwner
        s.heritageToken.transfer(vault.vaultOwner, totalDiggingFee + halfToEmbalmer);

        // transfer the other half of the cursed bond to the transaction caller
        s.heritageToken.transfer(paymentAddress, halfToSender);

        return (halfToSender, halfToEmbalmer);
    }

    function _hashHelper(bytes memory data) private pure returns (bytes32) {
        return keccak256(data);
    }
}
