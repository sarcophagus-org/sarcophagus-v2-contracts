// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/Base64.sol";

/// @title Stores metadata for an ERC1155 nft on chain.
abstract contract OnChainMetadata {
    struct Metadata {
        // Number of meta keys
        uint256 keyCount;
        // key => values
        // `data` maps to an array of bytes to support the attributes property,
        // which is an array of custom attributes. Every other property in the
        // metadata will map only to the first element in the array
        mapping(bytes32 => bytes[]) data;
        // key => number of values
        mapping(bytes32 => uint256) valueCount;
    }

    Metadata internal contractMetadata;

    // A mapping of the sarcophagus id to a mapping of the archaeologist address
    // to the curse token metadata
    // Example: tokenMetadata[sarcoId][archaeologist] = metadata
    // mapping(uint256 => mapping(address => Metadata)) private tokenMetadata;
    mapping(uint256 => Metadata) public tokenMetadata;

    // Used to look up the index of a trait type by name so that the corresponding value may be
    // updated
    mapping(bytes => uint256) public attributeIndexes;

    // Keys for the contract metadata
    bytes32 internal constant KEY_CONTRACT_NAME = "name";
    bytes32 internal constant KEY_CONTRACT_DESCRIPTION = "description";
    bytes32 internal constant KEY_CONTRACT_IMAGE = "image";

    // Keys for the token metadata
    bytes32 internal constant KEY_TOKEN_NAME = "name";
    bytes32 internal constant KEY_TOKEN_DESCRIPTION = "description";
    bytes32 internal constant KEY_TOKEN_IMAGE = "image";
    bytes32 internal constant KEY_TOKEN_BACKGROUND_COLOR = "background_color";
    bytes32 internal constant KEY_TOKEN_ATTRIBUTES_TRAIT_TYPE = "trait_type";
    bytes32 internal constant KEY_TOKEN_ATTRIBUTES_TRAIT_VALUE = "trait_value";
    bytes32 internal constant KEY_TOKEN_ATTRIBUTES_DISPLAY_TYPE =
        "trait_display";

    /// @notice Get the array of values of a token metadata key. An array is
    /// returned to support the attributes property, which is an array of custom
    /// attributes. In all other cases, the array will contain a single element.
    /// @param _tokenId the token identifier.
    /// @param _key the token metadata key.
    /// @return the array of values of the token metadata key.
    function getValues(uint256 _tokenId, bytes32 _key)
        internal
        view
        returns (bytes[] memory)
    {
        bytes[] memory result = tokenMetadata[_tokenId].data[_key];

        // Result length is 0

        return result;
    }

    /// @notice Get the first value of a token metadata key.
    /// @param _tokenId the token identifier.
    /// @param _key the token metadata key.
    /// @return the value of the token metadata key.
    function getValue(uint256 _tokenId, bytes32 _key)
        internal
        view
        returns (bytes memory)
    {
        bytes[] memory array = getValues(_tokenId, _key);
        if (array.length > 0) {
            return array[0];
        } else {
            return "";
        }
    }

    /// @notice Get the array of values of a contract metadata key. An array is
    /// returned to support the any properies that may be an array. In all other
    /// cases, the array will contain a single element.
    /// @param _key the contract metadata key.
    function getContractValues(bytes32 _key)
        internal
        view
        returns (bytes[] memory)
    {
        return contractMetadata.data[_key];
    }

    /// @notice Get the first value of a contract metadata key.
    /// @param _key the contract metadata key.
    /// @return the value of the contract metadata key.
    function getContractValue(bytes32 _key)
        internal
        view
        returns (bytes memory)
    {
        bytes[] memory array = getContractValues(_key);
        if (array.length > 0) {
            return array[0];
        } else {
            return "";
        }
    }

    /// @notice Set the values of a token metadata key whose value is an array.
    /// @param _tokenId the token identifier.
    /// @param _key the token metadata key.
    /// @param _values the array of values of the token metadata key.
    function setValues(
        uint256 _tokenId,
        bytes32 _key,
        bytes[] memory _values
    ) internal {
        Metadata storage meta = tokenMetadata[_tokenId];

        if (meta.valueCount[_key] == 0) {
            tokenMetadata[_tokenId].keyCount = meta.keyCount + 1;
        }
        tokenMetadata[_tokenId].data[_key] = _values;
        tokenMetadata[_tokenId].valueCount[_key] = _values.length;
    }

    /// @notice Set the a single value of a token metadata key.
    /// @param _tokenId the token identifier.
    /// @param _key the token metadata key.
    /// @param _value the value of the token metadata key.
    function setValue(
        uint256 _tokenId,
        bytes32 _key,
        bytes memory _value
    ) internal {
        bytes[] memory values = new bytes[](1);
        values[0] = _value;
        setValues(_tokenId, _key, values);
    }

    /// @notice Set the values of a contract metadata key whose value is an array.
    /// @param _key the contract metadata key.
    /// @param _values the array of values of the contract metadata key.
    function setContractValues(bytes32 _key, bytes[] memory _values) internal {
        if (contractMetadata.valueCount[_key] == 0) {
            contractMetadata.keyCount = contractMetadata.keyCount + 1;
        }
        contractMetadata.data[_key] = _values;
        contractMetadata.valueCount[_key] = _values.length;
    }

    /// @notice Set the a single value of a contract metadata key.
    /// @param _key the contract metadata key.
    /// @param _value the value of the contract metadata key.
    function setContractValue(bytes32 _key, bytes memory _value) internal {
        bytes[] memory values = new bytes[](1);
        values[0] = _value;
        setContractValues(_key, values);
    }

    // prettier-ignore
    /* solhint-disable */
    // Disabling prettier for this function because this code is nearly
    // impossible to read when wrapped.
    /// @notice Builds a URI string for the token metadata.
    /// @param _tokenId the token identifier.
    /// @return the token metadata URI.
    function createTokenURI(uint256 _tokenId)
        internal
        view
        virtual
        returns (string memory)
    {
        // Build attribute values
        bytes memory attributes;
        bytes[] memory traitType = getValues(_tokenId, KEY_TOKEN_ATTRIBUTES_TRAIT_TYPE);
        if (traitType.length > 0) {
            attributes = '[';
            bytes[] memory traitValue = getValues(_tokenId, KEY_TOKEN_ATTRIBUTES_TRAIT_VALUE);
            bytes[] memory traitDisplay = getValues(_tokenId, KEY_TOKEN_ATTRIBUTES_DISPLAY_TYPE);
            for (uint256 i = 0; i < traitType.length; i++) {
                attributes = abi.encodePacked( 
                    attributes, i > 0 ? ',' : '', '{',
                        '"display_type": "',  string(traitDisplay[i]), 
                        '", "trait_type": "', string(traitType[i]), 
                        '", "value": "',      string(traitValue[i]), 
                    '"}'
                );
            }
            attributes = abi.encodePacked(attributes, ']');
        }

        // Get the values of the token metadata
        string memory name = string(abi.decode(getValue(_tokenId, KEY_TOKEN_NAME), (string)));
        string memory description = string(abi.decode(getValue(_tokenId, KEY_TOKEN_DESCRIPTION), (string))); 
        bytes memory image = getValue(_tokenId, KEY_TOKEN_IMAGE); 

        return string(abi.encodePacked('data:application/json;base64,', Base64.encode(abi.encodePacked(
            '{',
                '"name": "', name, '", ',
                '"description": "', description, '"',
                bytes(image).length > 0 ? string(abi.encodePacked(', "image": "', string(abi.decode(image, (string))), '"')) : '',
                bytes(attributes).length > 0 ? string(abi.encodePacked(', "attributes": ', attributes)) : '',
            '}'
        ))));
    }

    // prettier-ignore
    // Disabling prettier for this function because this code is nearly
    // impossible to read when wrapped.
    /// @notice Builds a URI string for the contract metadata.
    /// @return the contract metadata URI.
    function createContractURI() internal view virtual returns (string memory) {
        bytes memory name = getContractValue(KEY_CONTRACT_NAME); 
        bytes memory description = getContractValue(KEY_CONTRACT_DESCRIPTION);
        bytes memory image = getContractValue(KEY_CONTRACT_IMAGE); 

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(abi.encodePacked(
          "{",
              "'name': '", string(abi.decode(name, (string))), "'", 
              bytes(description).length > 0 ? string(abi.encodePacked(", 'description': '", string(abi.decode(description, (string))), "'")) : "",
              bytes(image).length > 0 ? string(abi.encodePacked(", 'image': '", string(abi.decode(image, (string))), "'")) : "",
          "}"
      ))));
  }
}
