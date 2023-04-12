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

### Cache Array Length Outside of Loop

#### Impact
Issue Information: [G002](https://github.com/byterocket/c4-common-issues/blob/main/0-Gas-Optimizations.md#g002---cache-array-length-outside-of-loop)

#### Findings:
```
facets/ArchaeologistFacet.sol::268 => if (cursedArchaeologist.publicKey.length == 0) {
facets/EmbalmerFacet.sol::217 => uint256 nSelectedArchs = selectedArchaeologists.length;
facets/EmbalmerFacet.sol::218 => // Validate archaeologist and threshold lengths
facets/EmbalmerFacet.sol::257 => .length != 0
facets/EmbalmerFacet.sol::391 => uint256 nArchAddresses = archaeologistAddresses.length;
facets/EmbalmerFacet.sol::523 => uint256 nArchAddresses = archaeologistAddresses.length;
facets/ThirdPartyFacet.sol::135 => uint256 nCursedArchs = sarcophagus.cursedArchaeologistAddresses.length;
facets/ThirdPartyFacet.sol::220 => uint256 nSigs = signatures.length;
facets/ThirdPartyFacet.sol::222 => if (nSigs != publicKeys.length) {
facets/ThirdPartyFacet.sol::223 => revert DifferentNumberOfSignaturesAndPublicKeys(nSigs, publicKeys.length);
facets/ThirdPartyFacet.sol::254 => if (accusedArchaeologist.publicKey.length == 0) {
facets/ThirdPartyFacet.sol::291 => uint256 nCursedArchs = sarcophagus.cursedArchaeologistAddresses.length;
facets/ViewStateFacet.sol::38 => uint256 nAddresses = addresses.length;
facets/ViewStateFacet.sol::176 => uint256 archsLength = sarcophagus.cursedArchaeologistAddresses.length;
libraries/LibPrivateKeys.sol::25 => uint256 pubKeyLength = pubKey.length;
libraries/LibTypes.sol::32 => // Also used for curse checks -- is not bonded if length is 0
libraries/LibUtils.sol::76 => uint256 pubKeyLength = publicKey.length;
```
#### Tools used
[c4udit](https://github.com/byterocket/c4udit)

### Use immutable for OpenZeppelin AccessControl's Roles Declarations

#### Impact
Issue Information: [G006](https://github.com/byterocket/c4-common-issues/blob/main/0-Gas-Optimizations.md#g006---use-immutable-for-openzeppelin-accesscontrols-roles-declarations)

#### Findings:
```
libraries/LibPrivateKeys.sol::48 => uint256(keccak256(truncatedPublicKey)) &
libraries/LibUtils.sol::33 => bytes32 messageHash = keccak256(
libraries/LibUtils.sol::36 => keccak256(
libraries/LibUtils.sol::84 => bytes32 messageHash = keccak256(
libraries/LibUtils.sol::87 => keccak256(abi.encode(sarcoId, paymentAddress))
libraries/LibUtils.sol::95 => uint256(keccak256(truncatedPublicKey)) &
storage/LibAppStorage.sol::52 => bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("sarcophagus.storage.dev2");
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
storage/LibAppStorage.sol::5 => import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
```
#### Tools used
[c4udit](https://github.com/byterocket/c4udit)

### Use Shift Right/Left instead of Division/Multiplication if possible

#### Impact
Issue Information: [G008](https://github.com/byterocket/c4-common-issues/blob/main/0-Gas-Optimizations.md/#g008---use-shift-rightleft-instead-of-divisionmultiplication-if-possible)

#### Findings:
```
libraries/LibPrivateKeys.sol::14 => * @dev based on https://ethresear.ch/t/you-can-kinda-abuse-ecrecover-to-do-ecmul-in-secp256k1-today/2384/9
```
#### Tools used
[c4udit](https://github.com/byterocket/c4udit)

