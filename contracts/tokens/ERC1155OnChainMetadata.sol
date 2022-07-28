// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "./OnChainMetadata.sol";

/**
 * @title On-chain metadata for ERC1155, making quick and easy to create html/js
 * NFTs, parametric NFTs or any NFT with dynamic metadata.
 */
contract ERC1155OnChainMetadata is ERC1155, OnChainMetadata {
    // solhint-disable-next-line no-empty-blocks
    constructor() ERC1155("") {}

    function uri(uint256 _tokenId)
        public
        view
        override(ERC1155)
        returns (string memory)
    {
        return createTokenURI(_tokenId);
    }

    function contractURI() public view virtual returns (string memory) {
        return createContractURI();
    }
}
