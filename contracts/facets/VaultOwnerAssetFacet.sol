// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;


import "@openzeppelin/contracts/utils/Strings.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";
import "../HeritageAssetWillVault.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract VaultOwnerAssetFacet {
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;

    // IMPORTANT: AppStorage must be the first state variable in the facet.
    AppStorage internal s;

    

    

    Counters.Counter private _vaultCounter;

    event CreateVault(
        bytes32 indexed vaultId,
        string name,
        bool canBeTransferred,
        uint256 resurrectionTime,
        address vaultOwner,
        address recipient,
        address[] cursedSignatories,
        uint256 totalDiggingFees,
        uint256 createVaultProtocolFees,
        string[] arweaveTxIds
    );

    event AssetVaultCreated(
        bytes32 indexed vaultId,
        string name,
        address owner,
        address vaultAddress,        
        address[] signatories,
        uint256 totalDiggingFees,
        uint256 createVaultProtocolFees
    );


    // Signatory's addresses are added to this mapping per vault to
    // verify that the same signatory signature is not used more than once.
    mapping(bytes32 => mapping(address => bool)) private verifiedSignatories;

    


    // function toBytes(uint256 x) pure internal returns (bytes32 b) {
    //     b = new bytes(32);
    //     assembly { mstore(add(b, 32), x) }
    // }



    /// @notice Vault Owner creates the vault.
    ///
    /// The purpose of createVault is to:
    ///   - Lock up payment for the selected signatories (digging fees)
    ///   - Store the arweave TX IDs pertaining to the encrypted file payload
    ///   -    and the encrypted shards
    ///   - Verify the selected signatories have signed off on the
    ///         double hash of their key share,
    ///         arweave tx id storing key shares,
    ///         and maximumRewrapInterval to be used for lifetime of the sarcophagus
    ///   - Store the selected signatories' addresses, digging fees and
    ///   -     unencrypted double hashes
    ///   - Curse each participating signatory
    ///   - Create the sarcophagus object
    ///
    /// @param vaultData an object that contains the Vault data
    /// @param selectedSignatories the signatories the vaultOwner has selected to curse
    /// @return The index of the new Vault
    function createAssetVault(        
        LibTypes.CreateVaultData memory vaultData,
        LibTypes.SelectedSignatoryData[] memory selectedSignatories
    ) external returns (bytes32) {
        
        _vaultCounter.increment(); 
        bytes32 vaultId =  bytes32(_vaultCounter.current()); 

        // Confirm that the agreed upon vaultData parameters have not expired
        if (vaultData.timestamp + s.expirationThreshold < block.timestamp ) {
            revert LibErrors.VaultParametersExpired(
                vaultData.timestamp
            );
        }

        // // Confirm that the resurrection time is in the future
        // if (vaultData.resurrectionTime <= block.timestamp) {
        //     revert LibErrors.ResurrectionTimeInPast(
        //         vaultData.resurrectionTime
        //     );
        // }

        

        // Confirm that signatories are provided
        if (selectedSignatories.length == 0) {
            revert LibErrors.NoSignatoriesProvided();
        }

        

        // Initialize a list of signatory addresses to be passed in to the
        // vaultData object
        address[] memory signatories = new address[](
            selectedSignatories.length
        );

        uint256 totalDiggingFees = 0;

        for (uint256 i = 0; i < selectedSignatories.length; i++) {
            LibTypes.SelectedSignatoryData memory signer = selectedSignatories[i];
            LibUtils.revertIfSignatoryProfileDoesNotExist(signer.signatoryAddress);

            // // Confirm that the signatories list is unique. This is done by
            // // checking that the signatory does not already exist from
            // // previous iterations in this loop.
            // if (LibUtils.signatoryExistsOnSarc(vaultId, signer.signatoryAddress)) {
            //     revert LibErrors.ArchaeologistListNotUnique(
            //         signatories
            //     );
            // }

            
            totalDiggingFees += signer.diggingFee;

            LibTypes.SignatoryStorage memory signatoryStorage = LibTypes
                .SignatoryStorage({
                    diggingFee: signer.diggingFee,
                    diggingFeesPaid: 0,
                    unencryptedShardDoubleHash: bytes32(0),
                    unencryptedShard: new bytes(0)
                });

            
            // Save the necessary signatory data to the vaultData
            s.vaultSignatories[vaultId][
                signer.signatoryAddress
            ] = signatoryStorage;

            // Add the vaultData identifier to signatory's list of vaults
            s.signatoryVaults[signer.signatoryAddress].push(vaultId);

            // Todo
            // // Move free bond to cursed bond on signatory
            // LibBonds.curseArchaeologist(vaultId, signer.archAddress);

            // Add the signatory address to the list of addresses to be
            // passed in to the vaultData object
            signatories[i] = signer.signatoryAddress;
        }

        // Create the vaultData object and store it in AppStorage
        s.assetVaults[vaultId] = address(new HeritageAssetWillVault(msg.sender, vaultId,vaultData.name,vaultData.beneficiaries, signatories) );
        
        //  LibTypes.Vault({
        //     name: vaultData.name,
        //     state: LibTypes.SarcophagusState.Exists,
            
        //     resurrectionTime: vaultData.resurrectionTime,
            
        //     owner: msg.sender,
        //     beneficiaries: vaultData.beneficiaries,
        //     signatories: signatories
        // });

        // Add the identifier to the necessary data structures
        
        // s.vaultOwnerVaults[msg.sender].push(vaultId);
        // s.recipientVaults[vaultData.recipient].push(vaultId);

        // Transfer the total fees amount + protocol fees in Heritage token from the owner to this contract
        uint256 protocolFees = LibUtils.calculateProtocolFees(totalDiggingFees);

        // Add the create vaultData protocol fee to the total protocol fees in storage
        s.totalProtocolFees += protocolFees;

        s.heritageToken.safeTransferFrom(
            msg.sender,
            address(this),
            totalDiggingFees + protocolFees
        );

        // Emit the event
        emit AssetVaultCreated(
            vaultId,
            vaultData.name,            
            msg.sender,
            s.assetVaults[vaultId],
            signatories,
            totalDiggingFees,
            protocolFees
        );

        // emit CreateVault(
        //     vaultId,
        //     vaultData.name,
        //     vaultData.canBeTransferred,
        //     vaultData.resurrectionTime,
        //     msg.sender,
        //     vaultData.recipient,
        //     cursedSignatories,
        //     totalDiggingFees,
        //     protocolFees,
        //     arweaveTxIds
        // );

        // Return the index of the vaultData
        return vaultId;
    }

}
