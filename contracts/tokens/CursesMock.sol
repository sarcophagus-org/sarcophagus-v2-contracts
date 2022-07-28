// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./ERC1155OnChainMetadata.sol";
import "../interfaces/ICurses.sol";

contract CursesMock is ERC1155OnChainMetadata, Ownable, ICurses {
    error CurseAlreadyExists(uint256 sarcoId, address archaeologist);

    mapping(uint256 => bool) private ids;

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

        mint(
            msg.sender,
            1,
            "First Test",
            "First test of ERC1155OnChainMetadata",
            1,
            2
        );
    }

    /// @notice Mints a single curse nft with metadata.
    /// @param _to the address to mint the token to.
    /// @param _tokenId the token identifier.
    /// @param _name the token name.
    /// @param _description the token description.
    /// @param _diggingFee the digging fee.
    /// @param _bounty the bounty.
    function mint(
        address _to,
        uint256 _tokenId,
        string memory _name,
        string memory _description,
        uint256 _diggingFee,
        uint256 _bounty
    ) public {
        // Confirm that the nft doesn't already exist.
        if (ids[_tokenId] != false) {
            revert CurseAlreadyExists(_tokenId, _to);
        }

        // Set the token's metadata
        setValue(_tokenId, KEY_TOKEN_NAME, abi.encode(_name));
        setValue(
            _tokenId,
            KEY_TOKEN_DESCRIPTION,
            abi.encode(_description)
        );
        setValue(
            _tokenId,
            KEY_TOKEN_IMAGE,
            abi.encode(createSVG(_bounty, _diggingFee))
        );

        // Set up the array for attributes
        bytes[] memory traitTypes = new bytes[](2);
        bytes[] memory displayTypes = new bytes[](2);
        bytes[] memory values = new bytes[](2);

        // Define attributes trait types
        traitTypes[0] = abi.encodePacked("Digging Fee");
        traitTypes[1] = abi.encodePacked("Bounty");

        // Define attributes display types
        displayTypes[0] = abi.encodePacked("string");
        displayTypes[1] = abi.encodePacked("string");

        // Define attribute values
        values[0] = abi.encodePacked(Strings.toString(_diggingFee));
        values[1] = abi.encodePacked(Strings.toString(_bounty));

        // Save the attributes to the contract
        setValues(_tokenId, KEY_TOKEN_ATTRIBUTES_TRAIT_TYPE, traitTypes);
        setValues(
            _tokenId,
            KEY_TOKEN_ATTRIBUTES_DISPLAY_TYPE,
            displayTypes
        );
        setValues(_tokenId, KEY_TOKEN_ATTRIBUTES_TRAIT_VALUE, values);

        ids[_tokenId] = true;

        // Mint a single nft.
        // The token's id is set to the sarcophagus id, which means for every
        // archaeologist there will be a token with the same _sarcoId. Tokens are
        // made unique by the _sarcoId AND the archaeologist address.
        // The reason for this is to make looking up a set of nft's connected to
        // a sarcophagus easier.
        _mint(_to, _tokenId, 1, "");
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
    ) public override(ERC1155, ICurses) {
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

    // prettier-ignore
    /// @notice Generates a SVG image for the token based on the passed in attributes.
    /// @param _bounty the bounty of the token.
    /// @param _diggingFee the digging fee of the token.
    /// @return the SVG image for the token as a string.
    function createSVG(uint256 _bounty, uint256 _diggingFee) public pure returns (string memory) {
        return string( abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(string(abi.encodePacked(
            "<svg style='background-color:#000' viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'><text transform='translate(23.246 137.01)' dx='0' dy='0' fill='#ffffff' font-size='15' font-weight='400'>Sarcophagus</text><text transform='translate(23.246 176.56)' dx='0' dy='0' fill='#a6a6a6' font-size='8' font-weight='400' stroke-width='0'>Digging fee:</text><text transform='translate(23.246 162.56)' dx='0' dy='0' fill='#a6a6a6' font-size='8' font-weight='400' stroke-width='0'>Bounty:</text><text transform='translate(91.246 162.56)' dx='0' dy='0' fill='#a6a6a6' font-size='8' font-weight='400' stroke-width='0'>",
            Strings.toString(_bounty),
            " SARCO</text><text transform='translate(91.246 176.56)' dx='0' dy='0' fill='#a6a6a6' font-size='8' font-weight='400' stroke-width='0'>",
            Strings.toString(_diggingFee),
            " SARCO</text></svg>"
        ))))));
    }
}
