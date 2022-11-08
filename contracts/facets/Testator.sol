// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.13;

// import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/utils/Counters.sol";
// import "../storage/LibAppStorage.sol";
// import "../libraries/LibUtils.sol";
// import "../HeritageAssetWillVault.sol";

// contract Testator  {
//     using Counters for Counters.Counter;
//     using SafeERC20 for IERC20;

//     AppStorage internal s;

//     Counters.Counter private _vaultCounter;

//     event VaultCreated(
//         uint indexed vaultId,
//         string name,
//         address owner,
//         address vaultAddress,
        
//         address[] signatories,
//         uint256 totalDiggingFees,
//         uint256 createVaultProtocolFees
//     );

//     constructor() {
        
//     }

//     /// @notice Testator creates the vault.
//     ///
//     /// The purpose of createVault is to:
//     ///   - Lock up payment for the selected signatories (digging fees)
//     ///   - Store the arweave TX IDs pertaining to the encrypted file payload
//     ///   -    and the encrypted shards
//     ///   - Verify the selected archaeologists have signed off on the
//     ///         double hash of their key share,
//     ///         arweave tx id storing key shares,
//     ///         and maximumRewrapInterval to be used for lifetime of the sarcophagus
//     ///   - Store the selected archaeologists' addresses, digging fees and
//     ///   -     unencrypted double hashes
//     ///   - Curse each participating archaeologist
//     ///   - Create the sarcophagus object
//     ///
//     /// @param vaultData an object that contains the Vault data
//     /// @param selectedSignatories the archaeologists the embalmer has selected to curse
//     /// @return The index of the new sarcophagus
//     function createVault(        
//         LibTypes.CreateVaultData memory vaultData,
//         LibTypes.SelectedSignatoryData[] memory selectedSignatories
//     ) external returns (uint256) {
        
//         _vaultCounter.increment(); 
//         uint vaultId = _vaultCounter.current(); 

//         // Confirm that the agreed upon vaultData parameters have not expired
//         if (vaultData.timestamp + s.expirationThreshold < block.timestamp ) {
//             revert LibErrors.VaultParametersExpired(
//                 vaultData.timestamp
//             );
//         }

//         // // Confirm that the resurrection time is in the future
//         // if (vaultData.resurrectionTime <= block.timestamp) {
//         //     revert LibErrors.ResurrectionTimeInPast(
//         //         vaultData.resurrectionTime
//         //     );
//         // }

        

//         // Confirm that signatories are provided
//         if (selectedSignatories.length == 0) {
//             revert LibErrors.NoSignatoriesProvided();
//         }

        

//         // Initialize a list of signatory addresses to be passed in to the
//         // vaultData object
//         address[] memory signatories = new address[](
//             selectedSignatories.length
//         );

//         uint256 totalDiggingFees = 0;

//         for (uint256 i = 0; i < selectedSignatories.length; i++) {
//             LibTypes.SelectedSignatoryData memory signer = selectedSignatories[i];
//             LibUtils.revertIfSignatoryProfileDoesNotExist(signer.signatoryAddress);

//             // // Confirm that the signatories list is unique. This is done by
//             // // checking that the signatory does not already exist from
//             // // previous iterations in this loop.
//             // if (LibUtils.signatoryExistsOnSarc(vaultId, signer.signatoryAddress)) {
//             //     revert LibErrors.ArchaeologistListNotUnique(
//             //         signatories
//             //     );
//             // }

            
//             totalDiggingFees += signer.diggingFee;

//             LibTypes.SignatoryStorage memory signatoryStorage = LibTypes
//                 .SignatoryStorage({
//                     diggingFee: signer.diggingFee,
//                     diggingFeesPaid: 0
                    
//                 });

            
//             // Save the necessary archaeologist data to the vaultData
//             s.vaultSignatories[vaultId][
//                 signer.signatoryAddress
//             ] = signatoryStorage;

//             // Add the vaultData identifier to archaeologist's list of sarcophagi
//             s.signatoryVaults[signer.signatoryAddress].push(vaultId);

//             // Todo
//             // // Move free bond to cursed bond on archaeologist
//             // LibBonds.curseArchaeologist(vaultId, signer.archAddress);

//             // Add the archaeologist address to the list of addresses to be
//             // passed in to the vaultData object
//             signatories[i] = signer.signatoryAddress;
//         }

//         // Create the vaultData object and store it in AppStorage
//         s.vaults[vaultId] = new HeritageAssetWillVault(msg.sender, vaultId,vaultData.name,vaultData.beneficiaries, signatories);
        
//         //  LibTypes.Vault({
//         //     name: vaultData.name,
//         //     state: LibTypes.SarcophagusState.Exists,
            
//         //     resurrectionTime: vaultData.resurrectionTime,
            
//         //     owner: msg.sender,
//         //     beneficiaries: vaultData.beneficiaries,
//         //     signatories: signatories
//         // });

//         // Add the identifier to the necessary data structures
        
//         // s.embalmerSarcophagi[msg.sender].push(vaultId);
//         // s.recipientSarcophagi[vaultData.recipient].push(vaultId);

//         // Transfer the total fees amount + protocol fees in Heritage token from the owner to this contract
//         uint256 protocolFees = LibUtils.calculateProtocolFees(totalDiggingFees);

//         // Add the create vaultData protocol fee to the total protocol fees in storage
//         s.totalProtocolFees += protocolFees;

//         s.heritageToken.safeTransferFrom(
//             msg.sender,
//             address(this),
//             totalDiggingFees + protocolFees
//         );

//         // Emit the event
//         emit VaultCreated(
//             vaultId,
//             vaultData.name,            
//             msg.sender,
//             address(s.vaults[vaultId]),
//             signatories,
//             totalDiggingFees,
//             protocolFees
//         );

//         // Return the index of the vaultData
//         return vaultId;
//     }


    
// }