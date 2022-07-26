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
        uint256 _sarcoId,
        string memory _name,
        string memory _description,
        string memory _diggingFee,
        string memory _bounty
    ) external;

    function createSVG(string memory bounty, string memory diggingFee)
        external
        pure
        returns (string memory);
}
