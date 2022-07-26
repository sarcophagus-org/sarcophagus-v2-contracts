// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "./OnChainMetadata.sol";

/**
 * @title On-chain metadata for ERC1155, making quick and easy to create html/js
 * NFTs, parametric NFTs or any NFT with dynamic metadata.
 */
contract ERC1155OnChainMetadata is ERC1155, OnChainMetadata {
    // For looking up the owner of a token by its id.
    mapping(uint256 => address) internal owners;

    // solhint-disable-next-line no-empty-blocks
    constructor() ERC1155("") {}

    function uri(uint256 _tokenId)
        public
        view
        override(ERC1155)
        returns (string memory)
    {
        // Look up the token's owner since we can't pass it in as a function
        // argument
        address archaeologist = owners[_tokenId];
        return createTokenURI(_tokenId, archaeologist);
    }

    function contractURI() public view virtual returns (string memory) {
        return createContractURI();
    }
}
