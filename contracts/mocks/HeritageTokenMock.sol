// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract HeritageTokenMock is ERC20 {
    constructor() ERC20("HRTMock", "HERITAGE Mock") {
        _mint(msg.sender, 100 * 10**6 * 10**18);
    }
}
