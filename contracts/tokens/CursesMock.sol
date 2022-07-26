// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "./ERC1155OnChainMetadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ICurses.sol";

contract CursesMock is ERC1155OnChainMetadata, Ownable, ICurses {
    error CurseAlreadyExists(uint256 sarcoId, address archaeologist);

    mapping(uint256 => mapping(address => bool)) private ids;

    constructor() ERC1155OnChainMetadata() {
        setContractValue(
            KEY_CONTRACT_NAME,
            abi.encode("ERC1155OnChainMetadata Example")
        );
        setContractValue(
            KEY_CONTRACT_DESCRIPTION,
            abi.encode(
                "Simple example of ERC1155OnChainMetadata with on chain svg"
            )
        );
        setContractValue(KEY_CONTRACT_IMAGE, abi.encode(createSVG()));

        mint(
            msg.sender,
            0,
            "First Test",
            "First test of ERC1155OnChainMetadata",
            "someURI",
            "0",
            "0"
        );
    }

    /// @notice Transfers a NFT. Only the owner of the contract can transfer,
    /// not the owner of the NFT.
    /// @dev See {IERC1155-safeTransferFrom}. Overrides the ERC1155 method.
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) public override(ERC1155, ICurses) onlyOwner {
        _safeTransferFrom(_from, _to, _id, _amount, _data);
    }

    /// @notice Transfers a batch of NFTs. Only the owner of the contract can
    /// transfer, not the owner of the NFT.
    /// @dev See {IERC1155-safeBatchTransferFrom}. Overrides the ERC1155 method.
    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) public override(ERC1155, ICurses) onlyOwner {
        _safeBatchTransferFrom(_from, _to, _ids, _amounts, _data);
    }

    /// @notice Mints a single curse nft with metadata.
    /// @param _to the address to mint the token to.
    /// @param _sarcoId the token identifier.
    /// @param _name the token name.
    /// @param _description the token description.
    /// @param _imageURI the token image URI.
    function mint(
        address _to,
        uint256 _sarcoId,
        string memory _name,
        string memory _description,
        string memory _imageURI,
        string memory _diggingFee,
        string memory _bounty
    ) public onlyOwner {
        // Confirm that the nft doesn't already exist.
        if (ids[_sarcoId][_to] != false) {
            revert CurseAlreadyExists(_sarcoId, _to);
        }

        // Set the token's metadata
        setValue(_sarcoId, _to, KEY_TOKEN_NAME, abi.encode(_name));
        setValue(
            _sarcoId,
            _to,
            KEY_TOKEN_DESCRIPTION,
            abi.encode(_description)
        );
        setValue(_sarcoId, _to, KEY_TOKEN_IMAGE, abi.encode(_imageURI));

        // Set up the array for attributes
        bytes[] memory traitTypes = new bytes[](2);
        bytes[] memory displayTypes = new bytes[](2);
        bytes[] memory values = new bytes[](2);

        // Define attributes trait types
        traitTypes[0] = abi.encode("Digging Fee");
        traitTypes[1] = abi.encode("Bounty");

        // Define attributes display types
        displayTypes[0] = abi.encode("string");
        displayTypes[1] = abi.encode("string");

        // Define attribute values
        values[0] = abi.encode(_diggingFee);
        values[1] = abi.encode(_bounty);

        // Save the attributes to the contract
        setValues(_sarcoId, _to, KEY_TOKEN_ATTRIBUTES_TRAIT_TYPE, traitTypes);
        setValues(
            _sarcoId,
            _to,
            KEY_TOKEN_ATTRIBUTES_DISPLAY_TYPE,
            displayTypes
        );
        setValues(_sarcoId, _to, KEY_TOKEN_ATTRIBUTES_TRAIT_VALUE, values);

        ids[_sarcoId][_to] = true;

        // Set the token's owner for looking up the token's owner by tokenId
        owners[_sarcoId] = _to;

        // Mint a single nft.
        // The token's id is set to the sarcophagus id, which means for every
        // archaeologist there will be a token with the same sarcoId. Tokens are
        // made unique by the sarcoId AND the archaeologist address.
        // The reason for this is to make looking up a set of nft's connected to
        // a sarcophagus easier.
        _mint(_to, _sarcoId, 1, "");
    }

    function createSVG() public pure returns (string memory) {
        return "";
    }
}
