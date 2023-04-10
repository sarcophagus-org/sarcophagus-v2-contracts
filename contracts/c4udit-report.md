# c4udit Report

## Files analyzed
- facets/AdminFacet.sol
- facets/ArchaeologistFacet.sol
- facets/EmbalmerFacet.sol
- facets/ThirdPartyFacet.sol
- facets/ViewStateFacet.sol
- libraries/LibBonds.sol
- libraries/LibErrors.sol
- libraries/LibPrivateKeys.sol
- libraries/LibTypes.sol
- libraries/LibUtils.sol
- mocks/SarcoTokenMock.sol
- proxy/LibPrivateKeysProxy.sol
- proxy/LibUtilsProxy.sol
- storage/AppStorageInit.sol
- storage/LibAppStorage.sol

## Issues found

### Don't Initialize Variables with Default Value

#### Impact
Issue Information: [G001](https://github.com/byterocket/c4-common-issues/blob/main/0-Gas-Optimizations.md#g001---dont-initialize-variables-with-default-value)

#### Findings:
```
facets/EmbalmerFacet.sol::239 => uint256 totalDiggingFees = 0;
facets/EmbalmerFacet.sol::241 => for (uint256 i = 0; i < selectedArchaeologists.length; i++) {
facets/EmbalmerFacet.sol::367 => uint256 totalDiggingFees = 0;
facets/EmbalmerFacet.sol::373 => for (uint256 i = 0; i < archaeologistAddresses.length; i++) {
facets/EmbalmerFacet.sol::481 => for (uint256 i = 0; i < archaeologistAddresses.length; i++) {
facets/ThirdPartyFacet.sol::132 => uint256 totalDiggingFeesAndLockedBonds = 0;
facets/ThirdPartyFacet.sol::134 => for (uint256 i = 0; i < sarcophagus.cursedArchaeologistAddresses.length; i++) {
facets/ThirdPartyFacet.sol::217 => uint256 totalCursedBond = 0;
facets/ThirdPartyFacet.sol::218 => uint256 accusalCount = 0;
facets/ThirdPartyFacet.sol::219 => for (uint256 i = 0; i < signatures.length; i++) {
facets/ThirdPartyFacet.sol::276 => uint256 totalAccusals = 0;
facets/ThirdPartyFacet.sol::277 => for (uint256 i = 0; i < sarcophagus.cursedArchaeologistAddresses.length; i++) {
facets/ThirdPartyFacet.sol::296 => for (uint256 i = 0; i < sarcophagus.cursedArchaeologistAddresses.length; i++) {
facets/ViewStateFacet.sol::42 => for (uint256 i = 0; i < addresses.length; i++) {
facets/ViewStateFacet.sol::170 => uint8 publishedPrivateKeyCount = 0;
facets/ViewStateFacet.sol::171 => bool hasLockedBond = false;
facets/ViewStateFacet.sol::172 => for (uint256 i = 0; i < sarcophagus.cursedArchaeologistAddresses.length; i++) {
```
#### Tools used
[c4udit](https://github.com/byterocket/c4udit)

### Cache Array Length Outside of Loop

#### Impact
Issue Information: [G002](https://github.com/byterocket/c4-common-issues/blob/main/0-Gas-Optimizations.md#g002---cache-array-length-outside-of-loop)

#### Findings:
```
facets/ArchaeologistFacet.sol::255 => if (cursedArchaeologist.publicKey.length == 0) {
facets/EmbalmerFacet.sol::206 => // Validate archaeologist and threshold lengths
facets/EmbalmerFacet.sol::207 => if (selectedArchaeologists.length == 0) {
facets/EmbalmerFacet.sol::217 => if (sarcophagusParams.threshold > selectedArchaeologists.length) {
facets/EmbalmerFacet.sol::220 => selectedArchaeologists.length
facets/EmbalmerFacet.sol::235 => sarcophagus.cursedArchaeologistAddresses = new address[](selectedArchaeologists.length);
facets/EmbalmerFacet.sol::241 => for (uint256 i = 0; i < selectedArchaeologists.length; i++) {
facets/EmbalmerFacet.sol::249 => .length != 0
facets/EmbalmerFacet.sol::373 => for (uint256 i = 0; i < archaeologistAddresses.length; i++) {
facets/EmbalmerFacet.sol::481 => for (uint256 i = 0; i < archaeologistAddresses.length; i++) {
facets/ThirdPartyFacet.sol::134 => for (uint256 i = 0; i < sarcophagus.cursedArchaeologistAddresses.length; i++) {
facets/ThirdPartyFacet.sol::210 => if (signatures.length != publicKeys.length) {
facets/ThirdPartyFacet.sol::211 => revert DifferentNumberOfSignaturesAndPublicKeys(signatures.length, publicKeys.length);
facets/ThirdPartyFacet.sol::214 => address[] memory accusedArchAddresses = new address[](signatures.length);
facets/ThirdPartyFacet.sol::219 => for (uint256 i = 0; i < signatures.length; i++) {
facets/ThirdPartyFacet.sol::242 => if (accusedArchaeologist.publicKey.length == 0) {
facets/ThirdPartyFacet.sol::277 => for (uint256 i = 0; i < sarcophagus.cursedArchaeologistAddresses.length; i++) {
facets/ThirdPartyFacet.sol::296 => for (uint256 i = 0; i < sarcophagus.cursedArchaeologistAddresses.length; i++) {
facets/ViewStateFacet.sol::39 => addresses.length
facets/ViewStateFacet.sol::42 => for (uint256 i = 0; i < addresses.length; i++) {
facets/ViewStateFacet.sol::172 => for (uint256 i = 0; i < sarcophagus.cursedArchaeologistAddresses.length; i++) {
libraries/LibPrivateKeys.sol::23 => bytes memory truncatedPublicKey = new bytes(pubKey.length-1);
libraries/LibPrivateKeys.sol::24 => for (uint256 i = 1; i < pubKey.length; i++) {
libraries/LibTypes.sol::31 => // Also used for curse checks -- is not bonded if length is 0
libraries/LibUtils.sol::75 => bytes memory truncatedPublicKey = new bytes(publicKey.length - 1);
libraries/LibUtils.sol::76 => for (uint256 i = 1; i < publicKey.length; i++) {
```
#### Tools used
[c4udit](https://github.com/byterocket/c4udit)

### Use != 0 instead of > 0 for Unsigned Integer Comparison

#### Impact
Issue Information: [G003](https://github.com/byterocket/c4-common-issues/blob/main/0-Gas-Optimizations.md#g003---use--0-instead-of--0-for-unsigned-integer-comparison)

#### Findings:
```
facets/ArchaeologistFacet.sol::112 => if (freeBond > 0) {
facets/ArchaeologistFacet.sol::159 => if (freeBond > 0) {
facets/EmbalmerFacet.sol::167 => if (s.sarcophagi[sarcoId].resurrectionTime > 0) {
```
#### Tools used
[c4udit](https://github.com/byterocket/c4udit)

### Use immutable for OpenZeppelin AccessControl's Roles Declarations

#### Impact
Issue Information: [G006](https://github.com/byterocket/c4-common-issues/blob/main/0-Gas-Optimizations.md#g006---use-immutable-for-openzeppelin-accesscontrols-roles-declarations)

#### Findings:
```
libraries/LibPrivateKeys.sol::41 => uint160(uint256(keccak256(truncatedPublicKey)) & 0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
libraries/LibUtils.sol::33 => bytes32 messageHash = keccak256(
libraries/LibUtils.sol::36 => keccak256(
libraries/LibUtils.sol::79 => bytes32 messageHash = keccak256(
libraries/LibUtils.sol::82 => keccak256(abi.encode(sarcoId, paymentAddress))
libraries/LibUtils.sol::90 => uint256(keccak256(truncatedPublicKey)) &
storage/LibAppStorage.sol::51 => bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("sarcophagus.storage.dev2");
```
#### Tools used
[c4udit](https://github.com/byterocket/c4udit)

### Long Revert Strings

#### Impact
Issue Information: [G007](https://github.com/byterocket/c4-common-issues/blob/main/0-Gas-Optimizations.md#g007---long-revert-strings)

#### Findings:
```
facets/AdminFacet.sol::6 => import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";
facets/ArchaeologistFacet.sol::4 => import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
facets/EmbalmerFacet.sol::4 => import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
facets/EmbalmerFacet.sol::5 => import "@openzeppelin/contracts/utils/Strings.sol";
facets/ThirdPartyFacet.sol::4 => import {LibDiamond} from "hardhat-deploy/solc_0.8/diamond/libraries/LibDiamond.sol";
facets/ThirdPartyFacet.sol::6 => import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
mocks/SarcoTokenMock.sol::4 => import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
storage/AppStorageInit.sol::4 => import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
storage/LibAppStorage.sol::4 => import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
```
#### Tools used
[c4udit](https://github.com/byterocket/c4udit)

### Use Shift Right/Left instead of Division/Multiplication if possible

#### Impact
Issue Information: [G008](https://github.com/byterocket/c4-common-issues/blob/main/0-Gas-Optimizations.md/#g008---use-shift-rightleft-instead-of-divisionmultiplication-if-possible)

#### Findings:
```
facets/ArchaeologistFacet.sol::237 => if (sarcophagus.resurrectionTime == 2 ** 256 - 1) {
facets/EmbalmerFacet.sol::330 => if (sarcophagus.resurrectionTime == 2 ** 256 - 1) {
facets/EmbalmerFacet.sol::466 => if (sarcophagus.resurrectionTime == 2 ** 256 - 1) {
facets/EmbalmerFacet.sol::492 => sarcophagus.resurrectionTime = 2 ** 256 - 1;
facets/ThirdPartyFacet.sol::95 => if (sarcophagus.resurrectionTime == 2 ** 256 - 1) {
facets/ThirdPartyFacet.sol::206 => if (sarcophagus.resurrectionTime == 2 ** 256 - 1) {
facets/ThirdPartyFacet.sol::311 => uint256 halfTotalCursedBond = totalCursedBond / 2;
facets/ViewStateFacet.sol::186 => sarcophagus.resurrectionTime != 2 ** 256 - 1
libraries/LibPrivateKeys.sol::15 => * @dev based on https://ethresear.ch/t/you-can-kinda-abuse-ecrecover-to-do-ecmul-in-secp256k1-today/2384/9
```
#### Tools used
[c4udit](https://github.com/byterocket/c4udit)

### Unsafe ERC20 Operation(s)

#### Impact
Issue Information: [L001](https://github.com/byterocket/c4-common-issues/blob/main/2-Low-Risk.md#l001---unsafe-erc20-operations)

#### Findings:
```
facets/AdminFacet.sol::32 => s.sarcoToken.transfer(msg.sender, totalProtocolFees);
facets/ArchaeologistFacet.sol::113 => s.sarcoToken.transferFrom(msg.sender, address(this), freeBond);
facets/ArchaeologistFacet.sol::161 => s.sarcoToken.transferFrom(msg.sender, address(this), freeBond);
facets/ArchaeologistFacet.sol::183 => s.sarcoToken.transferFrom(msg.sender, address(this), amount);
facets/ArchaeologistFacet.sol::198 => s.sarcoToken.transfer(msg.sender, amount);
facets/ArchaeologistFacet.sol::211 => s.sarcoToken.transfer(msg.sender, amountToWithdraw);
facets/EmbalmerFacet.sol::292 => s.sarcoToken.transferFrom(msg.sender, address(this), totalDiggingFees + protocolFees);
facets/EmbalmerFacet.sol::442 => s.sarcoToken.transferFrom(msg.sender, address(this), totalDiggingFees + protocolFees);
facets/ThirdPartyFacet.sol::157 => s.sarcoToken.transfer(sarcophagus.embalmerAddress, totalDiggingFeesAndLockedBonds);
facets/ThirdPartyFacet.sol::314 => s.sarcoToken.transfer(sarcophagus.embalmerAddress, totalDiggingFees + halfTotalCursedBond);
facets/ThirdPartyFacet.sol::317 => s.sarcoToken.transfer(paymentAddress, halfTotalCursedBond);
```
#### Tools used
[c4udit](https://github.com/byterocket/c4udit)

### Unspecific Compiler Version Pragma

#### Impact
Issue Information: [L003](https://github.com/byterocket/c4-common-issues/blob/main/2-Low-Risk.md#l003---unspecific-compiler-version-pragma)

#### Findings:
```
facets/AdminFacet.sol::2 => pragma solidity ^0.8.13;
facets/ArchaeologistFacet.sol::2 => pragma solidity ^0.8.13;
facets/EmbalmerFacet.sol::2 => pragma solidity ^0.8.13;
facets/ThirdPartyFacet.sol::2 => pragma solidity ^0.8.13;
facets/ViewStateFacet.sol::2 => pragma solidity ^0.8.13;
libraries/LibBonds.sol::2 => pragma solidity ^0.8.13;
libraries/LibErrors.sol::2 => pragma solidity ^0.8.13;
libraries/LibPrivateKeys.sol::2 => pragma solidity ^0.8.13;
libraries/LibTypes.sol::2 => pragma solidity ^0.8.13;
libraries/LibUtils.sol::2 => pragma solidity ^0.8.13;
mocks/SarcoTokenMock.sol::2 => pragma solidity ^0.8.13;
proxy/LibPrivateKeysProxy.sol::2 => pragma solidity ^0.8.13;
proxy/LibUtilsProxy.sol::2 => pragma solidity ^0.8.13;
storage/AppStorageInit.sol::2 => pragma solidity ^0.8.13;
storage/LibAppStorage.sol::2 => pragma solidity ^0.8.13;
```
#### Tools used
[c4udit](https://github.com/byterocket/c4udit)

