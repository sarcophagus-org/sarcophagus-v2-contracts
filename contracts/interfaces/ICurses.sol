// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

interface ICurses {
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) external;

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) external;

    function mint(
        address _to,
        uint256 _tokenId,
        string memory _name,
        string memory _description,
        string memory _sarcophagusName,
        uint256 _diggingFee,
        uint256 _bounty,
        uint256 _resurrectionTime
    ) external;

    function updateAttribute(
        uint256 _tokenId,
        bytes memory _traitType,
        bytes memory _traitValue
    ) external;

    function createSVG(uint256 bounty, uint256 diggingFee)
        external
        pure
        returns (string memory);
}
